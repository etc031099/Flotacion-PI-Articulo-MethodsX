"""Deterministic fixed-step simulator. No third-party runtime dependencies."""
from copy import deepcopy
import math

VERSION = "1.0.0"
UNITS = {"time": "s", "level": "cm", "flow": "L/min", "volume": "L", "iae": "cm*s", "area": "cm^2", "kc": "L/min/cm", "k_prime": "cm/s/(L/min)", "kff": "1"}


def simc(k_prime, theta_s, tau_c_s, tau1_s=None):
    if not (k_prime < 0 and theta_s >= 0 and tau_c_s > 0 and tau_c_s >= theta_s):
        raise ValueError("SIMC requires negative k_prime and tau_c >= theta >= 0")
    if tau1_s is not None and tau1_s <= 0:
        raise ValueError("tau1 must be positive")
    return {"kc": 1 / (k_prime * (tau_c_s + theta_s)),
            "ti_s": min(tau1_s, 4 * (tau_c_s + theta_s)) if tau1_s is not None else 4 * (tau_c_s + theta_s)}


def validate_config(c):
    def require(ok, message):
        if not ok:
            raise ValueError(message)
    def num(x):
        return type(x) in (int, float) and math.isfinite(x)
    def integer(x):
        return num(x) and x == int(x)
    require(c.get("schema_version") == VERSION and c.get("kind") == "scenario", "Unsupported scenario version/kind")
    require(c.get("units") == UNITS, "Units must match schema 1.0.0")
    require(c.get("model") in ("physical", "identified"), "Unknown model")
    require(c.get("tuning") in ("paper_final", "simc"), "Unknown tuning")
    require(c.get("feedforward_mode") in ("paper_increment", "accumulated_increment"), "Unknown feedforward mode")
    require(num(c.get("dt_s")) and c["dt_s"] == 1, "This version requires dt_s = 1")
    require(integer(c.get("duration_s")) and 1 <= c["duration_s"] <= 86400, "Invalid duration")
    require(num(c.get("feed_lpm")) and c["feed_lpm"] >= 0, "Invalid feed")
    require(num(c.get("pump_min_lpm")) and num(c.get("pump_max_lpm")) and 0 <= c["pump_min_lpm"] < c["pump_max_lpm"], "Invalid pump limits")
    require(c["pump_min_lpm"] <= c["feed_lpm"] <= c["pump_max_lpm"], "Bias outside pump limits")
    require(isinstance(c.get("cells"), list) and len(c["cells"]) == 3, "Exactly three cells required")
    for cell in c["cells"]:
        for key in ("area_cm2", "height_cm", "initial_level_cm", "setpoint_cm", "k_prime", "theta_s", "tau_c_s", "kc_final", "ti_final_s", "kff"):
            require(num(cell.get(key)), "Invalid cell field: " + key)
        require(cell["area_cm2"] > 0 and cell["height_cm"] > 0, "Invalid geometry")
        require(0 <= cell["initial_level_cm"] <= cell["height_cm"] and 0 <= cell["setpoint_cm"] <= cell["height_cm"], "Level outside cell")
        require(integer(cell["theta_s"]) and 0 <= cell["theta_s"] <= 3600, "Delay must be integer seconds")
        require(cell["tau_c_s"] > 0 and cell["tau_c_s"] >= cell["theta_s"], "Invalid tau_c")
        require(cell["k_prime"] < 0 and cell["kc_final"] < 0 and cell["ti_final_s"] > 0 and 0 <= cell["kff"] <= 1, "Invalid controller")
    require(isinstance(c.get("events"), list), "events must be an array")
    for event in c["events"]:
        require(integer(event.get("time_s")) and 0 <= event["time_s"] < c["duration_s"], "Invalid event time")
        require(event.get("type") in ("feed", "setpoint") and num(event.get("value")), "Invalid event")
        if event["type"] == "feed":
            require(event["value"] >= 0, "Negative feed")
        else:
            require(integer(event.get("cell")) and 0 <= event["cell"] < 3, "Invalid cell index")
            require(0 <= event["value"] <= c["cells"][int(event["cell"])]["height_cm"], "Invalid setpoint")
    return c


def simulate(config, strategy="feedback"):
    c = deepcopy(validate_config(config))
    if strategy not in ("feedback", "feedback_feedforward"):
        raise ValueError("Unknown strategy")
    cells = c["cells"]
    # Identified storage is a virtual equivalent area, NOT the geometric cell.
    areas = [x["area_cm2"] if c["model"] == "physical" else 1000 / (60 * abs(x["k_prime"])) for x in cells]
    gains = [simc(-1000 / (60 * a), x["theta_s"], x["tau_c_s"]) if c["tuning"] == "simc" else {"kc": x["kc_final"], "ti_s": x["ti_final_s"]} for a, x in zip(areas, cells)]
    h = [x["initial_level_cm"] for x in cells]
    sp = [x["setpoint_cm"] for x in cells]
    integral = [0.0] * 3  # Integral contribution in L/min.
    ff = [0.0] * 3
    previous_in = [c["feed_lpm"]] * 3
    queues = [[c["feed_lpm"]] * int(x["theta_s"]) for x in cells]
    iae = [0.0] * 3
    rows = []
    feed = c["feed_lpm"]
    initial_volume = sum(a * level / 1000 for a, level in zip(areas, h))
    boundary_volume = 0.0
    for t in range(int(c["duration_s"])):
        for event in c["events"]:
            if event["time_s"] == t:
                if event["type"] == "feed":
                    feed = event["value"]
                else:
                    sp[int(event["cell"])] = event["value"]
        errors = [s - y for s, y in zip(sp, h)]
        commands, incoming, outgoing, spills, saturated = [], [], [], [], []
        # Upstream actual discharge is available in this interval downstream.
        for i, (cell, gain, area) in enumerate(zip(cells, gains, areas)):
            qin = feed if i == 0 else outgoing[i - 1]
            delta = qin - previous_in[i]
            previous_in[i] = qin
            if strategy == "feedback_feedforward":
                ff[i] = cell["kff"] * delta + (ff[i] if c["feedforward_mode"] == "accumulated_increment" else 0)
            base = c["feed_lpm"] + gain["kc"] * errors[i] + ff[i]
            increment = gain["kc"] / gain["ti_s"] * errors[i]
            trial = base + integral[i] + increment
            # Conditional integration: freeze only when integration drives further into saturation.
            if not ((trial > c["pump_max_lpm"] and increment > 0) or (trial < c["pump_min_lpm"] and increment < 0)):
                integral[i] += increment
            raw = base + integral[i]
            command = max(c["pump_min_lpm"], min(c["pump_max_lpm"], raw))
            if queues[i]:
                delayed = queues[i].pop(0)
                queues[i].append(command)
            else:
                delayed = command
            # Empty-cell protection; no hidden volume clipping.
            available = h[i] * area / 1000 + qin / 60
            qout = min(delayed, available * 60)
            volume = available - qout / 60
            spill = max(0.0, volume - area * cell["height_cm"] / 1000) * 60
            commands.append(command)
            incoming.append(qin)
            outgoing.append(qout)
            spills.append(spill)
            saturated.append(raw != command or qout != delayed)
        volume_before = [area * y / 1000 for area, y in zip(areas, h)]
        new_h = [1000 / a * (v + (qin - qout - spill) / 60) for a, v, qin, qout, spill in zip(areas, volume_before, incoming, outgoing, spills)]
        new_h = [max(0.0, y) for y in new_h]  # Only roundoff; dry protection above conserves volume.
        iae = [v + abs(e) for v, e in zip(iae, errors)]
        boundary_volume += (feed - outgoing[2] - sum(spills)) / 60
        residual = sum(a * y / 1000 for a, y in zip(areas, new_h)) - initial_volume - boundary_volume
        rows.append({"time_s": t, "level_cm": h[:], "setpoint_cm": sp[:], "error_cm": errors, "qin_lpm": incoming, "command_lpm": commands, "qout_lpm": outgoing, "spill_lpm": spills, "saturated": saturated, "next_level_cm": new_h[:], "balance_residual_l": residual})
        h = new_h
    return {"schema_version": VERSION, "kind": "result", "data_origin": "simulated", "units": UNITS.copy(), "strategy": strategy, "config": c, "storage_area_cm2": areas, "controllers": gains, "iae_cm_s": iae, "final_level_cm": h, "series": rows}


def compare(config):
    return {s: simulate(config, s) for s in ("feedback", "feedback_feedforward")}
