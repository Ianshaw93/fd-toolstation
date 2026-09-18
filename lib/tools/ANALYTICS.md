/**
 * Tool-search analytics (email-search shaped)
 * ==========================================
 *
 * Goal: gauge whether homepage search works — zero-result rate, top queries,
 * click-through / open rate, which parts are chosen for NL queries.
 *
 * This frontend always records. Durable storage is Railway Postgres on
 * `backendForNextApp` once `patches/backend-tool-search-analytics` is applied
 * (this repo cannot push that backend). Until then POSTs 204 and the forward
 * may 404; search UX is unaffected.
 *
 * Identity: homepage Profile/Logout are decorative — no SSO. `user_id` /
 * `user_email` are nullable. Sessions use cookie `fd_tool_search_anon`.
 * Follow-up: reuse FD Entra / Mail Marshal identity headers
 * (`x-ms-client-principal-name`, `x-ms-client-principal-id`). The ingest
 * already copies those headers when present.
 *
 * Schema (mirrors email-search `search_logs` + `search_clicks`)
 * ------------------------------------------------------------
 *
 * tool_search_logs
 *   id                 uuid pk
 *   created_at         timestamptz
 *   client_search_id   uuid  -- browser-generated, joins clicks
 *   query              text
 *   query_normalized   text
 *   result_count       int
 *   top_ids            jsonb -- part ids, max 20
 *   suggestion_id      text null
 *   confidence         text  -- none | low | medium | high
 *   mode               text  -- browse | keyword | intent
 *   latency_ms         int null
 *   anon_id            text
 *   user_id            text null  -- TODO Entra
 *   user_email         text null  -- TODO Entra
 *   source             text  -- toolstation-home
 *
 * tool_search_clicks
 *   id                 uuid pk
 *   created_at         timestamptz
 *   client_search_id   uuid
 *   part_id            text
 *   rank               int   -- 1-based position in the result list
 *   anon_id            text
 *   user_id            text null
 *   user_email         text null
 *   source             text
 *
 * Browser: POST /api/tool-search/log and /api/tool-search/click
 * Server:  forwards to Railway /tool-search/logs and /tool-search/clicks
 */
