# Privacy

The MA Field Guide exporter reads your own Math Academy activity and saves it as a file on your computer. It does not
send anything to the MA Field Guide, or to anyone else.

## What it does

- It runs only on `mathacademy.com`, in the tab where you are already signed in, when you press its button. It uses
  that tab's own sign-in; it never sees or stores your password.
- It asks Math Academy for your completed task history, a page at a time, and for the memory levels of the topics you
  have practised (one request per course, half a second apart).
- It writes the result to `ma-activity.json` in your Downloads folder. You choose whether to give that file to the
  knowledge graph page, which reads it in your browser.

## What it saves

- Each completed task's type (lesson, review, quiz, ...), its points and points earned, and when it started and finished
- The topic, its prerequisite topics, and the course
- For each topic you have practised: Math Academy's memory half-life and how many times it counts as practised

## What it leaves out

- Your name, email or account details
- Your student number. It is read from the page only to ask Math Academy about your own memory levels, and is never saved
- Questions, answers and how long you took on each
- Anything not listed under "What it saves"

## Where the data lives

To make updates quick, the extension keeps a copy of your last export in its own storage in your browser
(`storage.local`). Removing the extension deletes it. Nothing is sent to a server run by the MA Field Guide: the
extension has no server, no analytics and no tracking, and it loads no remote code.

## Permissions

- `host_permissions` for `mathacademy.com`: the only site it talks to
- `scripting`: to run the export in the Math Academy tab you have open
- `storage`: to remember your last export so updates fetch only what is new
- `activeTab` (Firefox build only): to act on the tab you click the button in

## Not affiliated

MA Field Guide is an independent community project. It is not affiliated with, endorsed by, or speaking for Math Academy.

## Contact

Questions or concerns: open an issue in this repository, or write to mafieldguide@gmail.com.
