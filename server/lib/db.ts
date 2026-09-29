import type { Repository } from "../../shared/repository.js";
import { config } from "../env.js";
import { createLocalRepository } from "./localDb.js";
import { createSupabaseRepository } from "./supabaseDb.js";

/**
 * Single repository instance for the process. Which driver is live is decided
 * once, at boot, from the environment — nothing downstream branches on it.
 */
export const repo: Repository = config.supabaseUsable
  ? createSupabaseRepository()
  : createLocalRepository();

if (!config.supabaseUsable) {
  process.stdout.write(
    "[raritone] storage: local driver (set SUPABASE_URL / SUPABASE_ANON_KEY / " +
      "SUPABASE_SERVICE_ROLE_KEY to use Postgres + Storage)\n",
  );
} else {
  process.stdout.write("[raritone] storage: supabase driver\n");
}
