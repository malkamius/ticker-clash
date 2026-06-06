# Changelog - TickerClash Port Restructuring

## Bug Fixes
- Fixed a startup crash in Express 5 caused by wildcard routing pattern incompatibility with path-to-regexp v8.
- Fixed an issue where the production/preview SSO callback and achievements failed to connect because of missing `AUTH_SERVER_URL` and `HUB_API_URL` environment variables in systemd.

## Changes
- Configured local development ports to Frontend: 28003 / Backend: 29003.
- Configured live preview ports to Frontend: 19003 / Backend: 20003.
- Added dual-port static serving on port 19003 and backend API on port 20003 in the preview environment.
- Configured dynamic dev/preview SSO redirection helpers.
