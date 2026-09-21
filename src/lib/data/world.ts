import { cache } from "react";
import { sql } from "@/lib/db/client";
import { loadWorld } from "./load-world";

/** Per-request memoised world (many components can call it, one load happens). */
export const getWorld = cache(() => loadWorld(sql));
