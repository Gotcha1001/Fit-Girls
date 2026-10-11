// convex/crons.ts
// If you already have a crons.ts, just add the one `crons.interval(...)` line.
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("refresh exchange rates", { hours: 12 }, internal.fx.refresh);

export default crons;
