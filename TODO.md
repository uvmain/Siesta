# siesta feature roadmap

- [x] Replace bearer-token access with a single-user, HttpOnly cookie session.
- [x] Bootstrap the initial account from `AUTH_USERNAME` and `AUTH_PASSWORD`, defaulting to `admin` / `password`.
- [x] Allow the signed-in user to change their password without replacing it from environment configuration.
- [x] Persist collections and named environments, including environment values, in SQLite.
- [x] Execute HTTP requests from the server and resolve `{{VARIABLE}}` placeholders from a selected environment.
- [x] Provide a browser UI for sign-in, composing a request, selecting an environment, and inspecting a response.
- [x] Add a collection and saved-request editor UI, with per-collection browser/backend execution selection.
- [x] Add environment editor UI with masked secret-value editing.
- [x] Support Basic and Bearer authentication helpers, multipart/form-data, and file uploads.
- [x] Import Postman collection JSON exports and individual Bruno `.bru` requests.
- [x] Add collection folders, Postman export, and saved request history.
- [x] Add request history, response search, and collection/environment backups.
- [ ] Add browser tests.
- [x] Add automated backend API tests.
