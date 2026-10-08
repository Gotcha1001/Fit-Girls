"use client";

import { useEffect, useState } from "react";
import {
  dayIndexOf,
  formatTime,
  SCHEDULE_TZ_LABEL,
} from "../convex/lib/schedule"; // adjust path to your shared import

export function useSastClock(tickMs = 1000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);

  return {
    now,
    timeLabel: formatTime(now),
    dayIndex: dayIndexOf(now),
    tz: SCHEDULE_TZ_LABEL,
  };
}
