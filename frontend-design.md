Build a modern, professional API development and testing web application inspired by Postman, Insomnia, and Bruno.

The application should allow developers to create, organise, execute, inspect, and manage HTTP API requests through an intuitive graphical interface.

The application should feel like a premium developer tool, with a polished desktop-first interface, excellent usability, fast interactions, and a strong emphasis on developer productivity.

Technology Stack
The application uses:

Frontend framework: Vue 3
Language: TypeScript
Build tool: Vite
Backend framework: Hono
Styling: UnoCSS
Component architecture: Reusable Vue components
Routing: Vue Router
Icons: Lucide
HTTP communication: Native Fetch API
Use Vue 3 Composition API and <script setup lang="ts"> throughout.

The frontend should communicate with the Hono backend through a clearly separated API service layer.

Do not tightly couple UI components to backend implementation details.

2. Design Philosophy
The application should have a visual identity of its own while taking inspiration from established API development tools.

The design should follow these principles:

Developer-focused and productivity-oriented.
Minimalist but feature-rich.
Dark-first interface with a carefully designed light theme.
High information density without feeling cluttered.
Clear visual hierarchy.
Consistent spacing, typography, and component behaviour.
Fast, responsive interactions.
Keyboard accessibility and shortcuts.
Professional appearance suitable for everyday development work.
Avoid excessive gradients, oversized cards, unnecessary whitespace, and generic dashboard aesthetics.

The interface should feel like a serious desktop application rather than a conventional SaaS administration dashboard.

Visual Theme
Use a dark theme as the default.

Suggested colour palette:


Element	Colour
Main background	#111318
Sidebar background	#171A21
Panel background	#1C2029
Elevated background	#232834
Border	#303643
Primary text	#E6EAF0
Secondary text	#929BAA
Accent	#8B7CFF
Success	#36B37E
Warning	#E5A93D
Error	#E05D68
Information	#55A6E8
Use a modern developer-oriented font such as Inter for UI text and JetBrains Mono for code and request-related values.

Use subtle borders rather than excessive shadows.

Support both dark and light themes through CSS variables or design tokens.

3. Overall Application Layout
The main application should use a desktop IDE-style layout.

The interface should consist of four primary areas:

Application navigation sidebar.
Main workspace and request editor.
Response inspector.
Optional contextual panels and overlays.
Application Shell
Create a persistent application shell containing:

Top navigation bar

Application logo and name.
Workspace selector.
Global search.
Environment selector.
Sync or connection status.
Settings access.
User profile menu.
Left navigation sidebar

A collapsible sidebar containing:

Collections
History
Environments
APIs
Mock Servers
Monitors
Settings
The sidebar should be resizable where appropriate.

Include a prominent create button for creating new requests, collections, and environments.

Main Workspace
The workspace should support multiple open requests using tabs.

Each tab should display:

HTTP method.
Request name.
Unsaved changes indicator.
Close button.
Allow users to switch between requests without losing their work.

Provide a plus button to create a new request.

The workspace should support multiple requests being open simultaneously.

4. Request Builder
The request builder is the most important part of the application.

It should occupy the main workspace and provide an intuitive way to construct HTTP requests.

Request URL Bar
At the top of the request editor, display:

HTTP method selector.
URL input.
Send button.
Save button.
Additional request actions menu.
Supported HTTP methods:

GET
POST
PUT
PATCH
DELETE
HEAD
OPTIONS
Use colour-coded method badges throughout the application.

Suggested colours:

GET: Green
POST: Yellow
PUT: Blue
PATCH: Purple
DELETE: Red
HEAD: Grey
OPTIONS: Cyan
The URL input should support:

URL autocomplete.
Variable suggestions.
Environment variable highlighting.
URL validation.
Query parameter awareness.
The Send button should have a clear loading state while a request is executing.

Request Configuration Tabs
Below the URL bar, provide the following tabs:

Params
Authorization
Headers
Body
Pre-request Script
Tests
Settings
Each tab should have a clear active state and display unsaved configuration changes where applicable.

Params
Display query parameters in an editable table.

Columns:

Enable checkbox.
Key.
Value.
Description.
Actions.
Features:

Add parameters.
Delete parameters.
Enable and disable individual parameters.
Automatically synchronise the table with the URL.
Preserve disabled parameters.
Support variable interpolation.
Authorization
Support common authentication mechanisms:

No Auth
Basic Auth
Bearer Token
API Key
OAuth 2.0
Show relevant configuration fields based on the selected authentication method.

Allow credentials to reference environment variables.

Sensitive credentials should be masked by default.

Headers
Display request headers in an editable table.

Columns:

Enable checkbox.
Header name.
Header value.
Description.
Actions.
Include common header suggestions and autocomplete.

Automatically manage headers where appropriate, but allow users to override them.

Body
Support the following body types:

None
Raw
JSON
XML
Text
HTML
JavaScript
Form Data
URL Encoded
Binary
Use Monaco Editor or CodeMirror for structured text bodies.

Provide syntax highlighting, formatting, and validation for JSON.

Include a format button for supported body types.

For multipart form data, provide a table interface for entering keys, values, and file references.

Pre-request Scripts
Provide a JavaScript code editor for scripts that execute before a request.

Include syntax highlighting and an editor toolbar.

Tests
Provide a JavaScript editor for writing response validation scripts.

Include a results panel displaying:

Test name.
Pass/fail status.
Error message.
Execution duration.
Settings
Provide request-specific configuration options, including:

Request timeout.
Redirect handling.
SSL certificate verification.
Follow redirects.
HTTP version preferences where supported.
5. Response Inspector
After executing a request, display the response in a dedicated panel beneath the request configuration.

The response panel should feel like a professional debugging tool.

Response Summary
Display a compact response metadata bar containing:

HTTP status code.
Status description.
Response time.
Response size.
Response timestamp.
Use colour-coded status indicators.

Response Tabs
Provide the following response tabs:

Pretty
Raw
Preview
Headers
Cookies
Test Results
Pretty
Display formatted response data with syntax highlighting.

Support:

JSON formatting.
XML formatting.
HTML formatting.
Syntax highlighting.
Expand and collapse JSON objects.
Copy response.
Search within response.
Line numbers.
For JSON responses, provide an interactive tree viewer.

Raw
Display the original response body without formatting.

Provide a copy action.

Preview
Render supported HTML and other previewable response content in a safe, isolated preview environment.

Headers
Display response headers in an easy-to-read table.

Cookies
Display cookies returned by the server.

Test Results
Display the results of the request's test scripts.

Include pass/fail indicators and useful error messages.

Response States
Design proper UI states for:

No request executed.
Request in progress.
Successful response.
Client error.
Server error.
Network error.
Timeout.
Invalid request.
Never leave the response panel empty without providing useful feedback.

6. Collections Management
Collections allow users to organise requests into logical groups.

The sidebar should display a hierarchical collection tree.

Features:

Create collections.
Rename collections.
Delete collections.
Create folders inside collections.
Nest folders.
Move requests between folders.
Duplicate requests.
Drag and drop requests.
Expand and collapse folders.
Save collection descriptions.
Each request should display its HTTP method badge and name.

Allow collections to be expanded to reveal their requests.

Provide contextual menus on right-click or through an ellipsis button.

Collection Details
When a collection is selected, display a collection overview with:

Collection name.
Description.
Number of requests.
Number of folders.
Collection-level variables.
Collection-level authorization.
Collection-level scripts.
Allow requests to inherit configuration from their parent collection where appropriate.

7. Request History
Implement a request history section.

Each history entry should display:

Request method.
URL or hostname.
Execution time.
HTTP status.
Timestamp.
Features:

Search history.
Filter by HTTP method.
Filter by status.
Reopen previous requests.
Clear history.
Save a history entry to a collection.
Use clear status indicators and compact list items.

8. Environment Management
Environments allow users to define reusable variables.

Examples:

Development
Staging
Production
Local
Allow users to:

Create environments.
Rename environments.
Delete environments.
Select an active environment.
Add and remove variables.
Edit variable values.
Mark variables as sensitive.
Import and export environment definitions.
Environment variables should use familiar syntax:

{{baseUrl}}

Support variable autocomplete throughout the request editor.

When displaying sensitive variables, mask their values by default.

Clearly indicate when a variable is unresolved.

9. API Workspace and Documentation
Include an APIs section where users can manage API definitions.

Provide the ability to:

Import OpenAPI specifications.
View API endpoints.
Browse endpoint documentation.
Inspect request and response schemas.
Create requests from documented endpoints.
The API documentation interface should be easy to navigate and should integrate with the request builder.

Use expandable endpoint groups and colour-coded HTTP methods.

10. Search and Command Palette
Implement a global search experience.

Search across:

Collections.
Requests.
Folders.
Environments.
History.
Provide a keyboard-accessible command palette using Ctrl+K / Cmd+K.

Suggested commands:

Create new request.
Create collection.
Open environment manager.
Search requests.
Toggle theme.
Open settings.
Navigate to history.
Display keyboard shortcuts alongside relevant commands.

11. Settings
Create a settings interface with sections for:

General.
Appearance.
Editor.
Keyboard shortcuts.
Network.
Privacy.
About.
Allow users to configure:

Default theme.
Font size.
Editor font.
Editor tab size.
Automatic JSON formatting.
Request timeout defaults.
Request history preferences.
12. Interaction and UX Requirements
The application should feel responsive and intuitive.

Implement the following UX behaviours:

Resizable sidebar and response panels.
Collapsible navigation sections.
Multiple request tabs.
Drag-and-drop collection organisation.
Context menus.
Tooltips for icon-only controls.
Loading indicators for asynchronous actions.
Toast notifications for success and errors.
Confirmation dialogs for destructive operations.
Keyboard navigation.
Keyboard shortcuts.
Unsaved changes indicators.
Autosaving where appropriate.
Empty states with clear calls to action.
Consistent focus states.
Smooth but subtle transitions.
Avoid unnecessary animations.

The interface should work particularly well at desktop resolutions, while remaining usable on tablets and smaller screens.

On smaller screens, adapt the layout by using drawers, stacked panels, and responsive navigation.