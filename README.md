# info

uploaded this project for coding portfolio example purposes as it can't be demoed due to using company live data.

- "node modules" dependencies folder is omitted
- "public" folder is missing, but content is currently in root (index.html, scripts.js, styles.css) that builds up the simple web interface for monitoring sync logs.


# fresh-air

Freshdesk to Airtable automation for workshop use for Ampler Bikes, to create Airtable dashboards.
It uses freshdesk webhooks that trigger on a ticket data change for a ticket that is warranty or service. Data is then parsed to match Airtable formats and all various time intervals for repair times are calculated and synced to Airtable.

Bulk of data comes over Freshdesk webhook that is setup in the admin panel in Freshdesk, but also extra data is fetched via API directly on a need basis. (all warranty diagnosis fields for instance)

Based on this data, dashboards for warranty & service are created.

The service runs on Heroku and build/deploy is handled there. Runs two instances:

- production
- development

Web interface is provided for sync monitoring:

- (dev - url hidden)
- (live - url hidden)

# run

Both environments are in a Heroku pipeline. (url hidden)
Dev build works on "WT sandbox" table and prod. works on "Warranty Tickets"

- to run, do 'heroku login' and log into the portal
- run locally 'heroku local -p 3000'
- view process 'heroku logs --tail'

Work on dev build and "WT sandbox" table and then promote to production directly in Heroku web interface.

more about installation on Heroku: https://devcenter.heroku.com/articles/heroku-cli

# notes

- Airtable must have all single and multi select options pre-defined. Whenever a new one is added to FD, it must be added to Airtable, otherwise sync will not work. If this error appears, it is visible in the web interface + BetterStack log triggers an e-mail.
- Changing any column name in Airtable also breaks the sync, so be careful with this.
- Data is synced this way since January 2024, ie every ticket that was updated after that time in Freshdeks has reached Airtable.




<img width="853" alt="Screenshot 2025-03-04 at 11 41 48" src="https://github.com/user-attachments/assets/963328ff-2c7d-432c-bc7e-d0c096e5f1b0" />

