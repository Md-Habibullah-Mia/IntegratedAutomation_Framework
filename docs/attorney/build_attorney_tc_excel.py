"""Builds the LexVerify (AttorneyProject) test-case workbook.

  python docs/attorney/build_attorney_tc_excel.py

Every case is grounded in the app's own code/docs (repo AiSolutionsUSA/AttorneyProject):
UI strings come from frontend/app/**/page.tsx, rules from "project docs/"
(USER_ONBOARDING_SIMPLE, USER_ROLES_OVERVIEW, MODULES, CAPABILITIES_MATRIX).
Automation column: Yes = automatable now against the pilot server without
accounts; Needs account = needs a test login from the team; Needs mailbox =
needs OTP/invite email access; Manual = not worth automating.
"""
import os
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

BASE = "http://34.232.246.13:3000"
H, M, L = "High", "Medium", "Low"
Y, ACC, MAIL, MAN = "Yes", "Needs account", "Needs mailbox", "Manual"

# (id, module, title, preconditions, steps, data, expected, priority, type, role, automation)
TC = []


def add(i, mod, title, pre, steps, data, exp, pri, typ, role, auto):
    TC.append((i, mod, title, pre, steps, data, exp, pri, typ, role, auto))


# ---------------------------------------------------------------- Landing
M_ = "Landing / Access Type"
add("LND-001", M_, "Landing page shows both access types", "None", f"1. Open {BASE}/", "",
    "'Select your access type' / 'Welcome to LexVerify' shown with two options: 'Individual / Petitioner' (SIGN IN) and 'Law Firm / Corporate' (REGISTER).", H, "UI", "Guest", Y)
add("LND-002", M_, "Individual option opens client login", "On landing page", "1. Click 'Individual / Petitioner'", "",
    "Navigates to /login (client). Subtitle reads 'Access your personal immigration workspace.' and no 'Register your firm' link is shown.", H, "Positive", "Guest", Y)
add("LND-003", M_, "Law Firm option opens firm register/login", "On landing page", "1. Click 'Law Firm / Corporate'", "",
    "Navigates to the firm registration/login flow for firms.", H, "Positive", "Guest", Y)
add("LND-004", M_, "'Change access type' returns to landing", "On /login", "1. Click '← Change access type'", "",
    "User returns to the landing page (/).", L, "Positive", "Guest", Y)

# ---------------------------------------------------------------- Registration
M_ = "Registration (Firm Admin)"
add("REG-001", M_, "Registration page renders", "None", f"1. Open {BASE}/register", "",
    "Heading 'Begin Firm Verification', 'Onboarding Phase I' badge, Work Email and Password fields, 'Create Secure Account' button, 'Terms of Protocol' and 'Sign in to your firm' links visible.", H, "UI", "Guest", Y)
add("REG-002", M_, "Empty email and password", "On /register", "1. Leave both fields empty\n2. Click 'Create Secure Account'", "",
    "Errors 'Work email is required.' and 'Password is required.'; no request sent; stays on /register.", H, "Negative", "Guest", Y)
add("REG-003", M_, "Invalid email format", "On /register", "1. Enter invalid email\n2. Enter valid password\n3. Submit", "Email: abc@xyz / abc.com / a b@c.com",
    "Error 'Enter a valid email.'; no account created.", H, "Negative", "Guest", Y)
add("REG-004", M_, "Password shorter than 8 characters", "On /register", "1. Enter valid email\n2. Enter 7-char password\n3. Submit", "Password: Ab1!xyz",
    "Error 'Minimum 8 characters.'; no account created.", H, "Negative", "Guest", Y)
add("REG-005", M_, "Password strength meter reacts to input", "On /register", "1. Type progressively stronger passwords", "a / abcdefgh / Abcdefg1 / Abcdef1!Xyz9",
    "'Security Strength' meter appears once typing starts; label/colour move from weak (red) to strong (green); 4 segments fill accordingly.", M, "UI", "Guest", Y)
add("REG-006", M_, "Show/hide password toggle", "On /register, password typed", "1. Click the eye icon\n2. Click again", "",
    "Password switches between masked and plain text.", L, "UI", "Guest", Y)
add("REG-007", M_, "Successful registration sends OTP", "Unused email with inbox access", "1. Enter new work email + valid password\n2. Click 'Create Secure Account'", "New unique email, Password: Test@12345",
    "Redirects to /verify; 'Verify Your Identity' with masked email; a 6-digit code email arrives.", H, "E2E", "Guest", MAIL)
add("REG-008", M_, "Already-confirmed email is rejected with sign-in hint", "Email already registered and confirmed", "1. Register again with the same email", "Existing firm admin email",
    "409 message shown under email and a 'Sign in instead →' link to /login?role=firm&email=<email>.", H, "Negative", "Guest", ACC)
add("REG-009", M_, "Registered-but-unconfirmed email re-sends code", "Email registered but OTP never confirmed", "1. Register again with same email", "",
    "Redirects to /verify?resent=1 with banner 'A fresh code is on its way.'", M, "Negative", "Guest", MAIL)
add("REG-010", M_, "'Sign in to your firm' link", "On /register", "1. Click 'Sign in to your firm'", "",
    "Navigates to /login?role=firm.", M, "Positive", "Guest", Y)
add("REG-011", M_, "Leading/trailing spaces in email", "On /register", "1. Enter '  user@firm.com  '\n2. Submit", "",
    "Email is trimmed or rejected consistently; no duplicate account created for the untrimmed value.", M, "Negative", "Guest", MAIL)
add("REG-012", M_, "Invite link pre-fills and locks email", "Valid invitation token", "1. Open /register?token=<token>", "",
    "Banner 'You've been invited to <case>' shown; email pre-filled and read-only.", H, "Positive", "Invitee", MAIL)
add("REG-013", M_, "Firm auto-created from email domain after confirmation", "Fresh registration confirmed", "1. Complete register + OTP\n2. Log in", "Email at smithlaw.com",
    "User lands on dashboard as Firm Admin of a firm named after the domain (e.g. 'Smith Law').", H, "E2E", "Firm Admin", MAIL)
add("REG-014", M_, "Very long email / password inputs", "On /register", "1. Enter 255+ char email or 256+ char password\n2. Submit", "",
    "Graceful validation error; no crash or 500.", L, "Boundary", "Guest", Y)
add("REG-015", M_, "Invitee sign-up banner shows the case name", "Opened a valid invite link", "1. Accept Invitation\n2. Read the banner on /register", "",
    "'You've been invited to <case name>'.", M, "UI", "Invitee", MAIL)
add("REG-016", M_, "Invitee sign-up page uses invitee wording", "Opened a valid invite link", "1. Accept Invitation\n2. Read /register", "",
    "Client/staff invitee sees sign-up copy for their role, not 'Begin Firm Verification' / 'Onboarding Phase I' / 'Sign in to your firm'.", L, "UI", "Invitee", MAIL)

# ---------------------------------------------------------------- OTP
M_ = "Email Verification (OTP)"
add("OTP-001", M_, "Verify page layout", "Just registered", "1. Observe /verify", "",
    "'Verify Your Identity', 'A 6-digit code has been sent to your email', masked email, 6 OTP cells, 'Verify Code' button, 'Resend in 01:00' countdown, '← Back to Registration'.", H, "UI", "Guest", Y)
add("OTP-002", M_, "Incomplete code", "On /verify", "1. Enter 5 digits\n2. Click 'Verify Code'", "12345",
    "Error 'Please enter the complete 6-digit code.'", H, "Negative", "Guest", Y)
add("OTP-003", M_, "Only digits accepted, auto-advance", "On /verify", "1. Type letters then digits", "a, 1, b, 2",
    "Letters ignored; each digit moves focus to the next cell.", M, "UI", "Guest", Y)
add("OTP-004", M_, "Paste full code fills all cells", "On /verify", "1. Paste '123456' into first cell", "",
    "All six cells filled; auto-submit triggers.", M, "UI", "Guest", Y)
add("OTP-005", M_, "Wrong code", "Registered, code received", "1. Enter a wrong 6-digit code", "000000",
    "Error message from server; cells cleared and focus back on the first cell.", H, "Negative", "Guest", MAIL)
add("OTP-006", M_, "Correct code confirms account", "Registered, code received", "1. Enter the emailed code", "",
    "Account confirmed; redirected to /login?role=firm.", H, "E2E", "Guest", MAIL)
add("OTP-007", M_, "Resend disabled during countdown", "On /verify", "1. Observe resend link for 60s", "",
    "'Resend in mm:ss' counts down and is not clickable; becomes 'Resend now' at 00:00.", M, "UI", "Guest", Y)
add("OTP-008", M_, "Resend issues a new code", "Countdown finished", "1. Click 'Resend now'", "",
    "New code emailed; countdown restarts; old code rejected.", M, "Positive", "Guest", MAIL)
add("OTP-009", M_, "Verify without registration context", "Fresh browser, no registration", f"1. Open {BASE}/verify directly\n2. Enter 6 digits", "123456",
    "Error 'Email not found. Please return to register.'", M, "Negative", "Guest", Y)
add("OTP-010", M_, "Expired code", "Code older than its validity window", "1. Enter expired code", "",
    "Clear expiry error; user can resend.", L, "Negative", "Guest", MAIL)

# ---------------------------------------------------------------- Login
M_ = "Login"
add("LGN-001", M_, "Firm login page layout", "None", f"1. Open {BASE}/login?role=firm", "",
    "'Secure Login', subtitle 'Access your firm's encrypted workspace.', Email/Password fields, 'Remember this device', 'Forgot password?', 'Secure Login' button, 'Register your firm' link.", H, "UI", "Guest", Y)
add("LGN-002", M_, "Client login page layout", "None", f"1. Open {BASE}/login?role=client", "",
    "Subtitle 'Access your personal immigration workspace.'; no 'Register your firm' link.", H, "UI", "Guest", Y)
add("LGN-003", M_, "Empty fields", "On login page", "1. Click 'Secure Login' with empty fields", "",
    "Error 'Please fill in all fields.'", H, "Negative", "Guest", Y)
add("LGN-004", M_, "Email only / password only", "On login page", "1. Fill only one field\n2. Submit", "",
    "Error 'Please fill in all fields.'", H, "Negative", "Guest", Y)
add("LGN-005", M_, "Wrong credentials", "On login page", "1. Enter unregistered email + any password\n2. Submit", "nobody+x@example.com / Wrong@123",
    "Server error message shown; user stays on login; no session stored.", H, "Negative", "Guest", Y)
add("LGN-006", M_, "Enter key submits", "On login page", "1. Fill fields\n2. Press Enter in password", "",
    "Login is attempted (same as clicking the button).", L, "UI", "Guest", Y)
add("LGN-007", M_, "Firm Admin login lands on dashboard", "Confirmed firm admin account", "1. Log in", "Firm admin credentials",
    "Redirected to /dashboard.", H, "Positive", "Firm Admin", ACC)
add("LGN-008", M_, "Client with case access lands on invited workspace", "Client with accepted case invitation", "1. Log in via client login", "Beneficiary credentials",
    "Redirected to /invited-workspace.", H, "Positive", "Beneficiary", ACC)
add("LGN-009", M_, "User with no firm or case access", "Confirmed account with no memberships", "1. Log in", "",
    "Redirected to /onboarding/pending.", M, "Positive", "Any", ACC)
add("LGN-010", M_, "Show/hide password", "On login page", "1. Toggle eye icon", "",
    "Password visibility toggles.", L, "UI", "Guest", Y)
add("LGN-011", M_, "Session-expired banner", "None", f"1. Open {BASE}/login?expired=1", "",
    "Amber banner 'Your session has expired. Please log in again.'", M, "UI", "Guest", Y)
add("LGN-012", M_, "Password field is masked by default", "On login page", "1. Type a password", "",
    "Characters are masked (type=password).", M, "Security", "Guest", Y)

# ---------------------------------------------------------------- Forgot password
M_ = "Forgot Password"
add("FPW-001", M_, "Forgot password page layout", "None", f"1. Open {BASE}/forgot-password", "",
    "'Reset Password', email field, 'Send Reset Code', '← Back to login'.", H, "UI", "Guest", Y)
add("FPW-002", M_, "Empty email", "On forgot password", "1. Click 'Send Reset Code' with empty email", "",
    "Error 'Please enter your email address.'", H, "Negative", "Guest", Y)
add("FPW-003", M_, "Invalid email", "On forgot password", "1. Enter invalid email\n2. Send", "abc@",
    "Error 'Enter a valid email address.'", H, "Negative", "Guest", Y)
add("FPW-004", M_, "Reset code sent for registered email", "Registered account with inbox", "1. Enter email\n2. Send Reset Code", "",
    "Moves to the code + new password step; code emailed.", H, "Positive", "Any", MAIL)
add("FPW-005", M_, "Incomplete reset code", "On reset step", "1. Enter fewer than 6 digits\n2. Submit", "",
    "Error 'Please enter the complete 6-digit code.'", M, "Negative", "Any", MAIL)
add("FPW-006", M_, "Passwords do not match", "On reset step", "1. Enter different new/confirm passwords\n2. Submit", "",
    "Error 'Passwords do not match.'", M, "Negative", "Any", MAIL)
add("FPW-007", M_, "Successful reset then login with new password", "On reset step", "1. Enter correct code + matching new password\n2. Log in with new password", "",
    "Reset succeeds; old password rejected; new password works.", H, "E2E", "Any", MAIL)
add("FPW-008", M_, "Unregistered email does not reveal account existence", "None", "1. Request reset for an unknown email", "",
    "Response does not disclose whether the account exists (no user enumeration).", M, "Security", "Guest", Y)
add("FPW-009", M_, "Back to login link", "On forgot password", "1. Click '← Back to login'", "",
    "Navigates to the login page.", L, "Positive", "Guest", Y)

# ---------------------------------------------------------------- Session / guards
M_ = "Session & Route Guards"
add("SES-001", M_, "Protected pages redirect to login when signed out", "Signed out", f"1. Open {BASE}/dashboard, /cases, /tasks, /team-member, /cases/new", "",
    "Each redirects to /login; no protected data shown.", H, "Security", "Guest", Y)
add("SES-002", M_, "Firm context kept on redirect from firm pages", "Signed out", f"1. Open {BASE}/dashboard", "",
    "Redirect lands on the firm login (role=firm) — currently lands on the individual login text (UX finding).", M, "UI", "Guest", Y)
add("SES-003", M_, "Logout clears session", "Logged in", "1. Log out\n2. Press Back / open /dashboard", "",
    "Protected pages are no longer reachable; redirected to login.", H, "Security", "Firm Admin", ACC)
add("SES-004", M_, "Expired access token refreshes or bounces to login", "Logged in, token expired", "1. Wait past token lifetime\n2. Navigate", "",
    "Session silently refreshed, or user sent to /login?expired=1 with the banner.", M, "Security", "Any", ACC)
add("SES-005", M_, "Already-logged-in user opening /login is routed", "Logged in", "1. Open /login", "",
    "Redirected to the correct workspace (dashboard / invited workspace).", L, "Positive", "Any", ACC)

# ---------------------------------------------------------------- Onboarding
M_ = "Onboarding Pending / Invited Workspace"
add("ONB-001", M_, "Pending onboarding page for user without access", "Account with no firm and no case access", "1. Log in", "",
    "/onboarding/pending explains the account has no firm/case yet and needs an invitation.", M, "UI", "Any", ACC)
add("ONB-002", M_, "Invited workspace lists client's cases only", "Client on 1+ cases", "1. Log in as client", "",
    "Only the cases the client was invited to are listed.", H, "Positive", "Beneficiary", ACC)
add("ONB-003", M_, "Invited workspace shows the beneficiary on the case row", "Client with accepted invite", "1. Open /invited-workspace", "",
    "Beneficiary column shows the beneficiary's name.", L, "UI", "Beneficiary", MAIL)

# ---------------------------------------------------------------- Dashboard
M_ = "Dashboard"
add("DSH-001", M_, "Firm dashboard loads", "Logged in as firm staff", "1. Open /dashboard", "",
    "Dashboard loads without errors; navigation to Cases, Tasks, Team is available.", H, "Positive", "Firm Admin", ACC)
add("DSH-002", M_, "'New Case' available only to Firm Admin", "Logged in", "1. Check dashboard as Firm Admin, Attorney, Paralegal", "",
    "Firm Admin sees 'New Case'; Attorney/Paralegal do not.", H, "Security", "All staff", ACC)
add("DSH-003", M_, "Dashboard shows only own firm's data", "Two firms exist", "1. Log in as Firm A admin", "",
    "No Firm B cases/members visible.", H, "Security", "Firm Admin", ACC)
add("DSH-004", M_, "Client cannot open firm dashboard", "Logged in as beneficiary", "1. Open /dashboard", "",
    "Access denied or redirected to invited workspace.", H, "Security", "Beneficiary", ACC)
add("DSH-005", M_, "Dashboard shows no fabricated data", "New firm with no cases/hearings", "1. Open /dashboard", "",
    "Greeting/summary reflects real data; no hardcoded 'priority hearings this week'.", M, "Negative", "Firm Admin", ACC)
add("DSH-006", M_, "'New Case' not offered to attorneys", "Logged in as Attorney", "1. Open /dashboard", "",
    "No '+ New Case' button (only Firm Admin can create cases).", M, "UI", "Attorney", MAIL)

# ---------------------------------------------------------------- Firm team
M_ = "Firm Team & Staff Invitations"
add("TEAM-001", M_, "Team page lists firm members", "Logged in as Firm Admin", "1. Open Team page", "",
    "Members listed with name, email, role, status; search box 'Search team members'.", H, "Positive", "Firm Admin", ACC)
add("TEAM-002", M_, "Invite an Attorney", "Firm Admin on Team page", "1. Click 'Add Team Member'\n2. Choose Attorney, enter email\n3. Send Invitation", "New email",
    "Invitation created as pending; email sent.", H, "Positive", "Firm Admin", ACC)
add("TEAM-003", M_, "Invite a Paralegal", "Firm Admin on Team page", "1. Add Team Member → Paralegal → Send", "New email",
    "Pending paralegal invitation created.", H, "Positive", "Firm Admin", ACC)
add("TEAM-004", M_, "Invalid / empty invite email", "Invite dialog open", "1. Submit with empty or invalid email", "",
    "Validation error; no invitation created.", H, "Negative", "Firm Admin", ACC)
add("TEAM-005", M_, "Attorney/Paralegal cannot invite staff", "Logged in as Attorney", "1. Open Team page / call invite API", "",
    "No 'Add Team Member' control; API returns 403.", H, "Security", "Attorney", ACC)
add("TEAM-006", M_, "Search team members", "Several members", "1. Type part of a name/email in search", "",
    "List filters to matching members.", L, "Positive", "Firm Admin", ACC)
add("TEAM-007", M_, "Resend pending invitation (inviter only)", "Pending invitation sent by me", "1. Resend", "",
    "New link emailed; old link invalid.", M, "Positive", "Firm Admin", MAIL)
add("TEAM-008", M_, "Revoke pending invitation (inviter only)", "Pending invitation sent by me", "1. Revoke\n2. Open the old link", "",
    "Invitation revoked; link shows it is no longer valid.", M, "Positive", "Firm Admin", MAIL)
add("TEAM-009", M_, "Non-inviter cannot revoke", "Invitation sent by another user", "1. Try to revoke it", "",
    "Action not allowed (documented policy: inviter only).", M, "Security", "Firm Admin", ACC)
add("TEAM-010", M_, "Duplicate invite to existing member", "Email already in firm", "1. Invite the same email again", "",
    "Clear error; no duplicate membership.", M, "Negative", "Firm Admin", ACC)
add("TEAM-011", M_, "Team page header shows the signed-in user", "Logged in as Firm Admin", "1. Open Team page", "",
    "Header shows the signed-in user's name/role; no placeholder user; filters list real offices/departments.", M, "UI", "Firm Admin", ACC)
add("TEAM-012", M_, "Firm Admin appears in the firm member list", "Logged in as Firm Admin", "1. Open Team page", "",
    "The Firm Admin's own membership is listed.", M, "Positive", "Firm Admin", ACC)
add("TEAM-013", M_, "Invite success screen gives a usable invite link", "Firm Admin", "1. Invite an Attorney\n2. Read 'Unique Invite Link'", "",
    "Link carries a real token (…/invite/accept?token=<token>) and the Invitation Token ID is filled.", H, "Negative", "Firm Admin", ACC)
add("TEAM-014", M_, "Invite success screen shows the chosen role", "Firm Admin", "1. Invite an Attorney\n2. Read 'Access Role'", "",
    "Access Role shows 'Attorney' (or 'Paralegal') as chosen.", M, "UI", "Firm Admin", ACC)

# ---------------------------------------------------------------- Invitation accept
M_ = "Invitation Accept"
add("INV-001", M_, "Accept page without token", "None", f"1. Open {BASE}/invite/accept", "",
    "Error 'No invitation token provided'.", H, "Negative", "Guest", Y)
add("INV-002", M_, "Invalid token", "None", f"1. Open {BASE}/invite/accept?token=invalid123", "",
    "Error 'Invalid invitation link'.", H, "Negative", "Guest", Y)
add("INV-003", M_, "Used or expired token", "Token already accepted", "1. Open the used link", "",
    "'This invitation has already been used or has expired'.", H, "Negative", "Invitee", MAIL)
add("INV-004", M_, "New user accepts via sign-up", "Valid token, email not registered", "1. Open link\n2. Sign up (email locked)\n3. Verify OTP\n4. Accept", "",
    "Account created, invitation accepted, lands in the right workspace.", H, "E2E", "Invitee", MAIL)
add("INV-005", M_, "Existing user accepts after login", "Valid token, account exists", "1. Open link while signed out\n2. Log in\n3. Accept Invitation", "",
    "Token preserved through login; after accept user is added (staff → firm, client → case).", H, "E2E", "Invitee", MAIL)
add("INV-006", M_, "Wrong account logged in", "Logged in as a different email", "1. Open invitation link", "",
    "'Wrong account' warning telling the user to switch to the invited email.", M, "Negative", "Invitee", MAIL)
add("INV-007", M_, "First accepted client invite activates draft case", "Draft case with pending client invite", "1. Client accepts", "",
    "Case status changes draft → active.", H, "E2E", "Beneficiary", MAIL)
add("INV-008", M_, "Firm staff cannot be invited as client on own firm case", "Existing paralegal email", "1. Invite that email as beneficiary on firm case", "",
    "Blocked with 'internal staff cannot also be a client' (known gap on some paths — record result).", M, "Security", "Firm Admin", ACC)
add("INV-009", M_, "Self-petition: same email as beneficiary and petitioner", "Draft case", "1. Invite same email for both roles\n2. Accept", "",
    "Both invitations accepted; person listed twice with both roles (expected).", M, "Positive", "Firm Admin", MAIL)
add("INV-010", M_, "Token can be used only once", "Accepted token", "1. Accept again in another browser", "",
    "Second attempt rejected.", H, "Security", "Invitee", MAIL)
add("INV-011", M_, "Invitation email names the case and firm", "Invite sent", "1. Open the invitation email", "",
    "Subject/body name the firm and case; no raw 'Firm ID' / 'Case ID' values; lands in the inbox, not spam.", M, "UI", "Invitee", MAIL)

# ---------------------------------------------------------------- Cases
M_ = "Case Management"
add("CASE-001", M_, "Create case page layout", "Firm Admin", "1. Open /cases/new", "",
    "'Create a new case', Case name field (placeholder 'Doe — EB-1A Petition'), Case type dropdown ('Select a case type…'), submit button.", H, "UI", "Firm Admin", ACC)
add("CASE-002", M_, "Case name required", "On /cases/new", "1. Leave name empty\n2. Submit", "",
    "Error 'Case name is required.'", H, "Negative", "Firm Admin", ACC)
add("CASE-003", M_, "Case type required", "On /cases/new", "1. Enter name, no type\n2. Submit", "",
    "Error 'Case type is required.'", H, "Negative", "Firm Admin", ACC)
add("CASE-004", M_, "Case types are loaded", "On /cases/new", "1. Open the Case type dropdown", "",
    "Seeded types listed (I-129 H-1B, I-485 AOS).", H, "Positive", "Firm Admin", ACC)
add("CASE-005", M_, "Create case successfully", "On /cases/new", "1. Enter name + type\n2. Submit", "Auto QA – H-1B <timestamp>",
    "Redirected to /cases/<id>/team; case is in draft; 'This case has no team yet…' shown.", H, "E2E", "Firm Admin", ACC)
add("CASE-006", M_, "Whitespace-only case name", "On /cases/new", "1. Enter '   ' as name\n2. Submit", "",
    "Error 'Case name is required.'", M, "Negative", "Firm Admin", ACC)
add("CASE-007", M_, "Attorney/Paralegal cannot create case", "Logged in as Attorney", "1. Open /cases/new / call create API", "",
    "Blocked (403 / no button).", H, "Security", "Attorney", ACC)
add("CASE-008", M_, "Case list shows firm cases with status", "Firm with cases", "1. Open /cases", "",
    "Cases listed with name, type, status (draft/active), missing-documents badge.", H, "Positive", "Firm Admin", ACC)
add("CASE-009", M_, "Case detail page", "Existing case", "1. Open /cases/<id>", "",
    "Case overview with tabs/links to Team, Questionnaires, Documents, Tasks; created date.", H, "Positive", "Firm Admin", ACC)
add("CASE-010", M_, "Edit case name / type (Firm Admin only)", "Existing case", "1. Edit name\n2. Save", "",
    "Change persisted; attorney/paralegal cannot edit.", M, "Positive", "Firm Admin", ACC)
add("CASE-011", M_, "Soft-delete case (Firm Admin only)", "Existing test case", "1. Delete case", "",
    "Case removed from list; others cannot delete.", M, "Positive", "Firm Admin", ACC)
add("CASE-012", M_, "Attorney sees only assigned cases' details", "Attorney assigned to case A only", "1. Open case B URL directly", "",
    "Access denied for unassigned case.", H, "Security", "Attorney", ACC)
add("CASE-013", M_, "Client sees only own case", "Beneficiary of case A", "1. Open /cases/<B id>", "",
    "Access denied.", H, "Security", "Beneficiary", ACC)
add("CASE-014", M_, "Non-existent case id", "Logged in", "1. Open /cases/999999", "",
    "'Case not found.' / 404 message, no crash.", M, "Negative", "Firm Admin", ACC)
add("CASE-015", M_, "Case detail shows no developer text", "Any case", "1. Open /cases/<id>", "",
    "No 'TODO (product)…' or other developer notes on the page.", L, "UI", "Firm Admin", ACC)
add("CASE-016", M_, "Case overview counts team members", "Case with an active beneficiary", "1. Open /cases/<id>", "",
    "'Team members' card shows the member count, not '0 — No one has access yet.'", M, "UI", "Firm Admin", MAIL)

# ---------------------------------------------------------------- Case team
M_ = "Case Team"
add("CTM-001", M_, "Empty draft case team message", "New draft case", "1. Open /cases/<id>/team", "",
    "'This case has no team yet. Add at least one beneficiary or petitioner…' shown.", H, "UI", "Firm Admin", ACC)
add("CTM-002", M_, "Invite beneficiary to case", "Draft case", "1. Add invitee → Beneficiary, email, optional names\n2. Send", "New email",
    "Pending row in team table (Name, Email, Role, Status).", H, "Positive", "Firm Admin", ACC)
add("CTM-003", M_, "Invite petitioner to case", "Draft case", "1. Add invitee → Petitioner → Send", "",
    "Pending petitioner row.", H, "Positive", "Firm Admin", ACC)
add("CTM-004", M_, "Invalid invitee email", "Case team page", "1. Enter invalid email\n2. Send", "invitee@",
    "Validation error; nothing created.", H, "Negative", "Firm Admin", ACC)
add("CTM-005", M_, "Assign existing firm member (attorney/paralegal)", "Firm has attorney", "1. 'Assign existing firm member' → choose → assign", "",
    "Member appears on case team with access.", H, "Positive", "Firm Admin", ACC)
add("CTM-006", M_, "New (non-firm) attorney cannot be added directly to a case", "Email not in firm", "1. Try to add as attorney on case", "",
    "Blocked; must join firm first.", M, "Negative", "Firm Admin", ACC)
add("CTM-007", M_, "Attorney on case can invite client", "Attorney assigned to case", "1. Invite beneficiary", "",
    "Allowed (own case only).", M, "Positive", "Attorney", ACC)
add("CTM-008", M_, "Only Firm Admin can remove team member", "Case with members", "1. Remove as Firm Admin\n2. Try as Attorney", "",
    "Firm Admin succeeds; attorney blocked.", M, "Security", "Firm Admin", ACC)
add("CTM-009", M_, "Case status flips to active after first acceptance", "Pending client invite", "1. Client accepts\n2. Reload team page", "",
    "Status 'active'; member row 'accepted'.", H, "E2E", "Firm Admin", MAIL)
add("CTM-010", M_, "Pending invitee listed on case team page", "Invite sent, not yet accepted", "1. Invite a beneficiary\n2. Reload /cases/<id>/team", "",
    "Invitee row with status 'pending' and a Resend action (page says 'Firm admins can resend pending invitations').", H, "Positive", "Firm Admin", ACC)
add("CTM-011", M_, "Member name uses the names given on the invite", "Invite with first/last name, accepted", "1. Open /cases/<id>/team", "",
    "Row shows 'QA Beneficiary', not an email-derived '<email> User'.", M, "UI", "Firm Admin", MAIL)

# ---------------------------------------------------------------- Questionnaires
M_ = "Questionnaires"
add("QNR-001", M_, "Questionnaires tab with 'Add questionnaire'", "Case with active client", "1. Open /cases/<id>/questionnaires", "",
    "List + 'Add questionnaire' button.", H, "UI", "Firm Admin", ACC)
add("QNR-002", M_, "Add questionnaire needs active beneficiary/petitioner", "Draft case, no accepted client", "1. Click 'Add questionnaire'", "",
    "Message 'This case has no active beneficiary or petitioner yet…'; cannot attach.", H, "Negative", "Firm Admin", ACC)
add("QNR-003", M_, "Attach published template to case", "Active client on case", "1. Add questionnaire → template (I-129 / I-485) → 'Filled by' role → confirm", "",
    "Questionnaire attached and listed.", H, "Positive", "Firm Admin", ACC)
add("QNR-004", M_, "Paralegal cannot attach questionnaire", "Paralegal on case", "1. Try Add questionnaire", "",
    "Not allowed.", H, "Security", "Paralegal", ACC)
add("QNR-005", M_, "Client fills and autosaves answers", "Questionnaire sent to client", "1. Client answers fields\n2. Reload", "",
    "Answers persisted (autosave / resume).", H, "Positive", "Beneficiary", ACC)
add("QNR-006", M_, "Conditional questions show/hide", "Section with conditional rules", "1. Toggle a controlling answer", "",
    "Dependent questions appear/disappear per rules.", M, "Positive", "Beneficiary", ACC)
add("QNR-007", M_, "Repeatable group add/remove", "Section with repeatable group", "1. Add and remove entries", "",
    "Entries added/removed and saved correctly.", M, "Positive", "Beneficiary", ACC)
add("QNR-008", M_, "Client submits questionnaire", "All required answers filled", "1. Submit", "",
    "Status → submitted; client can no longer edit unless changes requested.", H, "E2E", "Beneficiary", ACC)
add("QNR-009", M_, "Submit with missing required answers", "Required fields empty", "1. Submit", "",
    "Submission gated with clear message listing missing items.", H, "Negative", "Beneficiary", ACC)
add("QNR-010", M_, "Attorney requests changes", "Submitted questionnaire", "1. Request changes with comment", "",
    "Status → changes requested; client can edit again.", H, "Positive", "Attorney", ACC)
add("QNR-011", M_, "Attorney approves", "Submitted questionnaire", "1. Approve", "",
    "Status → approved.", H, "Positive", "Attorney", ACC)
add("QNR-012", M_, "Paralegal cannot approve / export / archive", "Paralegal on case", "1. Look for Approve, Export PDF, Archive", "",
    "Actions not available; API 403.", H, "Security", "Paralegal", ACC)
add("QNR-013", M_, "Export approved questionnaire as PDF", "Approved questionnaire", "1. Export PDF", "",
    "PDF downloads with the answers (feature-flagged).", M, "Positive", "Attorney", ACC)
add("QNR-014", M_, "Client-visible vs internal comments", "Questionnaire open", "1. Staff adds internal and client-visible comments\n2. View as client", "",
    "Client sees only client-visible comments.", H, "Security", "Attorney", ACC)
add("QNR-015", M_, "Manual reminder to recipient", "Pending recipient", "1. Send reminder", "",
    "Reminder sent; clients cannot send reminders.", M, "Positive", "Paralegal", ACC)

# ---------------------------------------------------------------- Documents
M_ = "Documents"
add("DOC-001", M_, "Documents page gated until questionnaire exists", "Case without questionnaire", "1. Open /cases/<id>/documents", "",
    "'Questionnaire required before document collection' with 'Back to Case Overview'.", H, "Negative", "Firm Admin", ACC)
add("DOC-002", M_, "Required documents checklist", "Case with questionnaire", "1. Open Documents", "",
    "Checklist of required documents with green/yellow/red status pills.", H, "UI", "Firm Admin", ACC)
add("DOC-003", M_, "Upload valid PDF", "Documents page", "1. Upload a document → category → PDF < 25 MB", "sample.pdf",
    "Upload succeeds; checklist updates.", H, "Positive", "Beneficiary", ACC)
add("DOC-004", M_, "Upload JPEG / PNG", "Documents page", "1. Upload .jpg and .png", "",
    "Both accepted.", M, "Positive", "Beneficiary", ACC)
add("DOC-005", M_, "Reject unsupported file type", "Upload modal open", "1. Choose .docx / .exe / .txt", "",
    "Rejected; only 'PDF, JPEG, or PNG'.", H, "Negative", "Beneficiary", ACC)
add("DOC-006", M_, "Reject file over 25 MB", "Upload modal open", "1. Choose a 26 MB PDF", "",
    "'File exceeds the 25 MB limit.'; upload disabled.", H, "Negative", "Beneficiary", ACC)
add("DOC-007", M_, "Staff upload on behalf of client", "Firm staff on case", "1. Upload with 'on behalf' toggle", "",
    "Document stored with upload source attorney_on_behalf; toggle hidden for clients.", M, "Positive", "Paralegal", ACC)
add("DOC-008", M_, "Download document", "Uploaded document", "1. Download", "",
    "Original file downloads intact.", M, "Positive", "Firm Admin", ACC)
add("DOC-009", M_, "Soft-delete document", "Uploaded document", "1. Delete", "",
    "Removed from list; checklist recalculated.", M, "Positive", "Firm Admin", ACC)
add("DOC-010", M_, "Client cannot see other cases' documents", "Two cases", "1. Client opens other case docs URL", "",
    "Access denied.", H, "Security", "Beneficiary", ACC)
add("DOC-011", M_, "Missing-documents badge on case list", "Case with missing required docs", "1. Open /cases", "",
    "Badge shows missing count.", L, "UI", "Firm Admin", ACC)

# ---------------------------------------------------------------- AI read-in
M_ = "AI Read-In (Extraction)"
add("AI-001", M_, "Upload triggers AI extraction", "Upload with AI enabled", "1. Upload passport PDF", "",
    "Extraction runs; banner shows AI suggestions awaiting review.", M, "Positive", "Firm Admin", ACC)
add("AI-002", M_, "'Disable AI run' skips extraction", "Upload modal", "1. Tick disable AI\n2. Upload", "",
    "No extraction created.", M, "Positive", "Firm Admin", ACC)
add("AI-003", M_, "Review page approve/edit/reject fields", "Completed extraction", "1. Open extract review\n2. Decide per field", "",
    "Decisions recorded; source highlight shown.", M, "Positive", "Attorney", ACC)
add("AI-004", M_, "Paralegal cannot 'Confirm Approved Edits'", "Paralegal on case", "1. Try confirm", "",
    "Blocked (403).", M, "Security", "Paralegal", ACC)
add("AI-005", M_, "Clients cannot access extraction", "Beneficiary", "1. Open extraction URL", "",
    "403.", H, "Security", "Beneficiary", ACC)

# ---------------------------------------------------------------- Tasks
M_ = "Tasks"
add("TSK-001", M_, "Case tasks page for staff", "Staff on case", "1. Open /cases/<id>/tasks", "",
    "Task list with due dates and status; open-task badge in navigation.", M, "Positive", "Attorney", ACC)
add("TSK-002", M_, "Create task", "Staff on case", "1. Create task with title, description, due date, assignee", "",
    "Task listed as pending.", M, "Positive", "Attorney", ACC)
add("TSK-003", M_, "Mark task complete", "Open task", "1. Click 'Mark complete'", "",
    "Status 'Completed'; badge count decreases.", M, "Positive", "Attorney", ACC)
add("TSK-004", M_, "Unauthorized user sees 'Access forbidden'", "User not on case", "1. Open /cases/<id>/tasks", "",
    "'Access forbidden — You do not have permission to view tasks for this case.'", H, "Security", "Attorney", ACC)
add("TSK-005", M_, "Task comments", "Existing task", "1. Add comment", "",
    "Comment appears with date.", L, "Positive", "Attorney", ACC)

# ---------------------------------------------------------------- Non-functional
M_ = "Security & Non-functional"
add("SEC-001", M_, "Site served over HTTPS", "None", f"1. Open {BASE}", "",
    "App should be served over HTTPS; pilot currently uses plain HTTP (credentials in clear text) — finding.", H, "Security", "Guest", Y)
add("SEC-002", M_, "API rejects requests without token", "None", "1. Call a protected API (e.g. GET /api/v1/cases) without Authorization", "",
    "401.", H, "Security", "Guest", Y)
add("SEC-003", M_, "Cross-firm isolation via direct API", "Tokens for Firm A and B", "1. Request Firm B case with Firm A token", "",
    "403/404, no data leak.", H, "Security", "Firm Admin", ACC)
add("SEC-004", M_, "XSS in case name / names", "Firm Admin", "1. Create case named <script>alert(1)</script>", "",
    "Rendered as text, no script execution.", M, "Security", "Firm Admin", ACC)
add("SEC-005", M_, "Brute-force on invitation tokens", "None", "1. Try many random tokens", "",
    "No rate limiting today (documented gap) — record as risk.", L, "Security", "Guest", MAN)
add("SEC-006", M_, "Page load performance", "None", "1. Measure landing/login load", "",
    "Pages load within acceptable time (< 3 s).", L, "Performance", "Guest", Y)
add("SEC-007", M_, "Responsive layout on mobile width", "None", "1. Open register/login at 375px width", "",
    "No horizontal scroll; forms usable.", L, "UI", "Guest", Y)
add("SEC-008", M_, "Interactive API docs not publicly exposed", "None", "1. Open http://34.232.246.13:8000/docs", "",
    "Swagger/OpenAPI UI is not reachable on a pilot/production server (or is behind auth).", H, "Security", "Guest", Y)

# Automated run results (src/web/attorney/tests/public-high-priority.spec.ts,
# attorney-chromium, 2026-09-28, each test run twice — results were stable).
PASS, FAIL = "Pass", "Fail"
RESULTS = {tc: (PASS, "Automated — passed (2/2 runs)") for tc in [
    "LND-001", "LND-002", "LND-003", "REG-001", "REG-002", "REG-003", "REG-004", "OTP-001", "OTP-002",
    "LGN-001", "LGN-002", "LGN-003", "LGN-004", "LGN-005", "FPW-001", "FPW-002", "FPW-003",
    "INV-001", "INV-002", "SEC-002"]}
RESULTS["SES-001"] = (FAIL, "BUG: /dashboard, /cases, /tasks, /team-member redirect to login, but /cases/new "
                            "renders the 'Create a new case' form to a signed-out user (API still 401s, so case "
                            "types show 'No case types available'). Missing route guard.")
RESULTS["SEC-001"] = (FAIL, "BUG: pilot is served over plain http://34.232.246.13:3000 — passwords and tokens travel unencrypted.")
RESULTS["SEC-008"] = (FAIL, "BUG: http://34.232.246.13:8000/docs returns 200 — full Swagger UI of the API is public.")
RESULTS["SES-002"] = ("Not Run", "Observed manually: signed-out /dashboard lands on /login with the individual "
                                 "text ('personal immigration workspace') instead of the firm login.")

# Firm Admin run (src/web/attorney/tests/firm-admin.spec.ts, one login, 2026-09-28).
for tc in ["LGN-007", "DSH-001", "DSH-002", "CASE-001", "CASE-002", "CASE-003", "CASE-004", "CASE-005",
           "CASE-008", "CASE-009", "CASE-014", "CTM-001", "CTM-002", "CTM-003", "CTM-004", "QNR-001", "QNR-002",
           "TEAM-001", "TEAM-002", "TEAM-003", "TEAM-004", "SES-003"]:
    RESULTS[tc] = (PASS, "Automated — passed (firm-admin.spec.ts)")
RESULTS["CTM-004"] = (PASS, "Automated — passed. Note: the browser's native email check fires first; the app's "
                            "own message ('Invalid email: …') only shows with native validation off.")
RESULTS["DOC-001"] = (PASS, "Automated — passed. Minor: breadcrumb shows 'Case #<id>' instead of the case name.")
RESULTS["DSH-005"] = (FAIL, "BUG: brand-new firm with no cases shows 'You have 3 priority hearings this week' (hardcoded).")
RESULTS["TEAM-011"] = (FAIL, "BUG: Team page header shows placeholder 'Sarah Jenkins, Senior Associate'; office "
                             "filter lists mock values (New York HQ, London, Munich…).")
RESULTS["TEAM-012"] = ("Fail", "BUG (observed): Firm Admin is not listed — 'Showing 0-0 of 0 members'.")
RESULTS["TEAM-013"] = (FAIL, "BUG: after inviting an Attorney, 'Unique Invite Link' is …/invite/accept?token=null and "
                             "'Invitation Token ID' is empty — the link can't be used.")
RESULTS["TEAM-014"] = (FAIL, "BUG: invited as Attorney/Paralegal, but the success screen shows Access Role 'Standard User'.")
RESULTS["CASE-015"] = (FAIL, "BUG: case detail shows developer text 'TODO (product): add a per-case due_at…'.")
RESULTS["CTM-010"] = (FAIL, "BUG: invite succeeds ('Invitation sent to …'), but the invitee never appears on the team "
                            "page — table stays 'No team members yet', so there is nothing to resend.")

# Invitation run (src/web/attorney/tests/invitation-onboarding.spec.ts, real
# email via the QA Gmail inbox, 2026-09-28).
for tc in ["REG-007", "REG-008", "REG-012", "OTP-005", "OTP-006", "LGN-008", "ONB-002", "INV-004", "INV-007",
           "CTM-009", "DSH-004", "CASE-013", "DOC-010", "AI-005", "FPW-004", "FPW-007", "TEAM-005", "CASE-007",
           "CTM-005"]:
    RESULTS[tc] = (PASS, "Automated — passed (invitation-onboarding.spec.ts)")
RESULTS["TEAM-002"] = (PASS, "Automated — passed; invited attorney also signed up via the emailed link and landed on /dashboard.")
RESULTS["DSH-004"] = (PASS, "Automated — passed. /dashboard is not redirected for clients; it renders a client view "
                            "(Client navigation, own case only, no firm controls).")
RESULTS["OTP-006"] = (PASS, "Automated — passed. After verify, an invitee is sent to the firm login (/login?role=firm).")
RESULTS["INV-003"] = (FAIL, "BUG: opening an already-accepted invitation link still shows 'You've been invited' with an "
                            "enabled 'Accept Invitation' button.")
RESULTS["INV-010"] = RESULTS["INV-003"]
RESULTS["INV-011"] = (FAIL, "BUG: subject 'You are invited to join Immigration Platform'; body shows 'Role: client', "
                            "'Firm ID: 8', 'Case ID: 8' and no case/firm name. After a few test invites Gmail started "
                            "filing these emails as Spam (deliverability).")
RESULTS["REG-015"] = (FAIL, "BUG: banner reads 'You've been invited to Case #<id>' instead of the case name.")
RESULTS["REG-016"] = (FAIL, "BUG: client invitee sees firm-owner copy: 'Begin Firm Verification', 'Onboarding Phase I', "
                            "'Sign in to your firm'.")
RESULTS["ONB-003"] = (FAIL, "BUG: Beneficiary column on the invited workspace shows '— —'.")
RESULTS["CTM-011"] = (FAIL, "BUG: invited as 'QA Beneficiary', the member shows as 'Pulseapktester+ben<ts> User'.")
RESULTS["CASE-016"] = (FAIL, "BUG: overview card says 'Team members 0 — No one has access yet.' while the Team tab lists "
                             "the active beneficiary.")
RESULTS["DSH-006"] = (FAIL, "BUG: attorney's dashboard shows '+ New Case' (the API correctly returns 403).")
RESULTS["CASE-012"] = (FAIL, "BUG (security): attorney not assigned to the case gets 200 with full details from "
                             "GET /api/v1/cases/<id>; roles doc says attorneys act only on assigned cases.")


# ---------------------------------------------------------------- Workbook
COLS = ["TC ID", "Module", "Title", "Preconditions", "Test Steps", "Test Data", "Expected Result",
        "Priority", "Type", "Role", "Automation", "Status", "Actual Result / Notes"]
WIDTHS = [11, 22, 38, 28, 44, 24, 52, 9, 11, 13, 15, 10, 30]
HEAD = PatternFill("solid", fgColor="1F3A5F")
PFILL = {H: "FDE2E1", M: "FFF4D6", L: "E6F4EA"}
thin = Side(style="thin", color="C9CED6")
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)

wb = Workbook()
ws = wb.active
ws.title = "Test Cases"
ws.append(COLS)
for c, w in enumerate(WIDTHS, 1):
    ws.column_dimensions[get_column_letter(c)].width = w
    cell = ws.cell(row=1, column=c)
    cell.font = Font(bold=True, color="FFFFFF")
    cell.fill = HEAD
    cell.alignment = Alignment(vertical="center", horizontal="center", wrap_text=True)
    cell.border = BORDER
ws.row_dimensions[1].height = 30
for t in TC:
    status, note = RESULTS.get(t[0], ("Not Run", ""))
    row = list(t)
    if t[0] in RESULTS and t[0] not in ("SES-002", "TEAM-012"):
        row[10] = Y  # covered by a spec now, even if it first needed an account
    ws.append(row + [status, note])
for r in range(2, ws.max_row + 1):
    for c in range(1, len(COLS) + 1):
        cell = ws.cell(row=r, column=c)
        cell.alignment = Alignment(vertical="top", wrap_text=True)
        cell.border = BORDER
    pri = ws.cell(row=r, column=8)
    pri.fill = PatternFill("solid", fgColor=PFILL[pri.value])
    pri.font = Font(bold=True)
    st = ws.cell(row=r, column=12)
    if st.value in ("Pass", "Fail"):
        st.fill = PatternFill("solid", fgColor="C6EFCE" if st.value == "Pass" else "FFC7CE")
        st.font = Font(bold=True)
ws.freeze_panes = "C2"
ws.auto_filter.ref = ws.dimensions
dv = DataValidation(type="list", formula1='"Not Run,Pass,Fail,Blocked"', allow_blank=True)
ws.add_data_validation(dv)
dv.add(f"L2:L{ws.max_row}")

# Summary sheet
s = wb.create_sheet("Summary", 0)
s["A1"] = "LexVerify (AttorneyProject) — Test Cases"
s["A1"].font = Font(bold=True, size=14)
s["A2"] = f"Environment: {BASE}  |  Source: code + project docs of AiSolutionsUSA/AttorneyProject"
s["A3"] = "Automation key: Yes = automatable now without accounts · Needs account = test logins required · Needs mailbox = OTP/invite email access required · Manual"
modules = []
for t in TC:
    if t[1] not in modules:
        modules.append(t[1])
s.append([])
s.append(["Module", "Total", "High", "Medium", "Low", "Automatable now"])
hdr = s.max_row
for c in range(1, 7):
    s.cell(row=hdr, column=c).font = Font(bold=True, color="FFFFFF")
    s.cell(row=hdr, column=c).fill = HEAD
for m in modules:
    rows = [t for t in TC if t[1] == m]
    s.append([m, len(rows), sum(t[7] == H for t in rows), sum(t[7] == M for t in rows),
              sum(t[7] == L for t in rows), sum(t[10] == Y for t in rows)])
s.append(["TOTAL", len(TC), sum(t[7] == H for t in TC), sum(t[7] == M for t in TC),
          sum(t[7] == L for t in TC), sum(t[10] == Y for t in TC)])
for c in range(1, 7):
    s.cell(row=s.max_row, column=c).font = Font(bold=True)
s.column_dimensions["A"].width = 40
for col in "BCDEF":
    s.column_dimensions[col].width = 16

# Automation plan: High priority in execution order (automatable-now first)
a = wb.create_sheet("High Priority Plan")
a.append(["Order", "TC ID", "Module", "Title", "Automation", "Planned spec", "Result"])
for c in range(1, 8):
    a.cell(row=1, column=c).font = Font(bold=True, color="FFFFFF")
    a.cell(row=1, column=c).fill = HEAD
rank = {Y: 0, ACC: 1, MAIL: 2, MAN: 3}
high = sorted([t for t in TC if t[7] == H], key=lambda t: (rank[t[10]], TC.index(t)))
for n, t in enumerate(high, 1):
    spec = {Y: "public-high-priority.spec.ts", ACC: "needs test accounts", MAIL: "needs mailbox access", MAN: "manual"}[t[10]]
    a.append([n, t[0], t[1], t[2], t[10], spec, RESULTS.get(t[0], ("Not Run", ""))[0]])
for col, w in zip("ABCDEFG", [7, 11, 28, 60, 16, 28, 10]):
    a.column_dimensions[col].width = w

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "LexVerify_Test_Cases.xlsx")
wb.save(out)
print(out, "|", len(TC), "test cases |", sum(t[7] == H for t in TC), "high |", sum(t[10] == Y for t in TC), "automatable now")
