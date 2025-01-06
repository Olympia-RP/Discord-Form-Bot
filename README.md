# 🤖 Discord Form Bot

A powerful Discord bot that allows server administrators to create customizable forms for various purposes such as suggestions, applications, reports, and more. The bot supports private forms, public forms, and suggestion forms with voting capabilities! ✨

## ⭐ Features

- 📝 **Multiple Form Types**:
  - 🔒 Private Forms (responses visible only to staff)
  - 📢 Public Forms (approved responses posted publicly)
  - 💡 Suggestion Forms (approved suggestions can be voted on)

- 🎨 **Form Customization**:
  - ✏️ Custom titles, descriptions, and colors
  - 🖼️ Custom thumbnails and footers
  - 🔘 Customizable submit buttons
  - 📋 Up to 5 form fields per form
  - ⚡ Optional/required fields
  - 💭 Field placeholders

- 🛡️ **Permission System**:
  - 👑 Role-based permissions for form setup
  - 📮 Role-based permissions for form submissions
  - ✅ Role-based permissions for form approval/denial

- ⚙️ **Response Management**:
  - 👮 Staff approval/denial system
  - 📝 Reason requirements for approvals/denials
  - 📨 Optional DM notifications to users submitting forms
  - 🗳️ Voting system for suggestions (👍/👎)

## 🚀 Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure the bot by editing `config.yml`:
   ```yaml
   bot:
     token: "your-bot-token"
     client_id: "your-bot-client-id"

   guilds:
     - id: "your-guild-id"
       permissions:
         setup_command: # roles that can use /setup
           roles: ["role-id-1", "role-id-2"]
         form_approval: # roles that can approve/deny forms
           roles: ["role-id-1", "role-id-2"]
         form_submission: # roles that can submit forms
           roles: ["role-id-1", "role-id-2"]

   send_dm_to_submitter: false # set to true to enable DM notifications
   ```

4. Start the bot:
   ```bash
   npm start
   ```

## 📖 Usage

### 🛠️ Setting Up a Form

1. Use the `/setup` command to start creating a form
2. Configure the form using the interactive buttons:
   - 📝 Set Title
   - 📄 Set Description
   - 🎨 Set Color (hex format)
   - 🖼️ Set Thumbnail (image URL)
   - ✍️ Set Footer
   - ➕ Add Form Fields
   - 🔘 Customize Button
   - 📢 Set Response Channel
   - 🌐 Set Public Channel (for public/suggestion forms)

3. Choose the form type from the dropdown:
   - 🔒 Private Form
   - 📢 Public Form
   - 💡 Suggestion Form

4. 👀 Use the Preview button to see how your form will look
5. ✅ Click Accept to create the form

### 📋 Form Fields Configuration

When adding form fields:
- 🏷️ Set a label (max 45 characters)
- 💭 Add an optional placeholder
- ⚡ Choose if the field is required
- ✨ Add up to 5 fields per form

### 📮 Form Submission Process

1. 🖱️ Users click the submit button on the form
2. ✍️ Fill out the form fields in the modal
3. 📨 Submit the form

For staff members:
1. 👀 Review submissions in the designated response channel
2. ✅ Click Approve or ❌ Deny
3. 📝 Provide a reason for the decision

For public/suggestion forms:
- 📢 Approved submissions appear in the designated public channel
- 🗳️ For suggestion forms, users can vote using 👍/👎 buttons

## 🔑 Permissions

Configure these roles in your `config.yml`:

- 🛠️ `setup_command`: Roles that can create forms
- ✅ `form_approval`: Roles that can approve/deny submissions
- 📮 `form_submission`: Roles that can submit forms