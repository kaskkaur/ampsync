// This app is an integration between Freshdesk and Airtable Warranty tickets table.
// It gets its data from Freshdesk webhook that triggers via Freshdesk automations feature when a ticket is updated
// It then parses that data, creates new required data like timestamps for each status change and passes to Airtable
// This node.js app uses express.js and is hosted on Heroku. 


const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');

const app = express();
app.use(bodyParser.json());

app.use(express.static('public'));

const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});



const personalAccessToken = process.env.PERSONAL_ACCESS_TOKEN;
const baseId = process.env.BASE_ID;
const fdKey = process.env.FD_KEY;

const fDurlTickets = "https://amplerbikes.freshdesk.comapi/v2/tickets";
const fdApiUrlTicketFields = "https://amplerbikes.freshdesk.com/api/v2/admin/ticket_fields";
const domain = "https://amplerbikes.freshdesk.com";
const tableName = 'Tickets';
const workshopsApi = `https://api.airtable.com/v0/${baseId}/Locations?fields%5B%5D=Name`;
const assigneeApi = `https://api.airtable.com/v0/${baseId}/Mechanics?fields%5B%5D=Name`;
const statusApi = `https://api.airtable.com/v0/${baseId}/Status?fields%5B%5D=Name`;

let workshopsMapping = {};
let assigneeMapping = {};
let statusMapping = {};
let recordName = "";

let airTableErrorCheck = false;

let dateTime = "";
let ticketID = "";
let statusInput = "";
let eventData = {};
let dateHuman = "";
let ticketAPIdata = {};




let latestLogData = {
    logs: [] // Initialize with empty logs array
};

let log = {};


const MAX_LOGS = 1000;


function clearLogsIfNeeded() {
    if (latestLogData.logs.length >= MAX_LOGS) {
        const logsToRemove = latestLogData.logs.length - MAX_LOGS + 1;
        latestLogData.logs.splice(0, logsToRemove);
        console.log("logs cleared");
    }
}

function pushLog(log) {
    latestLogData.logs.push(log);
    
}






function getCurrentDateTime() {
// I get base time to use for generating all the timestamps status changes
    const now = new Date();
    dateTime = now.toISOString();
    dateHuman = now.toLocaleString();
    return now.toISOString();
}



function prepFieldsForUpdate(timeValues) {
// Prepare all fields so they are accepted properly by Airtable. 
//I only pass on the fields that have changed, as they come from FD webhook

	
	console.log("EVENT DATA TAGS IN PREPFIELDS HEADER", eventData.tags)

	let group = "";
	let status = "";
	let statusLinked = [];
	let tagsArray = [];
	let airFields = {};
	let airFieldsToUpdate = {};

	



if (eventData.group == "Technical Support" && eventData.status == "Open" || eventData.group == "Accounting"){

		group = "Warranty";
		status = "3 Repaired";
		statusLinked = [getRecordId(status, statusMapping)];

	} else {

		group = eventData.group;
		status = eventData.status;
		statusLinked = [getRecordId(eventData.status, statusMapping)];
	}


    if (eventData.tags) {
    	console.log("EVENT DATA TAGS IN PREPFIELDS IF CONDITION", eventData.tags)


        const tagString = eventData.tags;
		tagsArray = tagString.split(/\s*,\s*/).filter(tag => tag.trim() !== '');

		console.log("TAGS AFTER PROCESSING:", tagsArray)



    } else {
    	console.log("EVENT DATA TAGS IN PREPFIELDS ELSE CONDITION", eventData.tags)
        tagsArray = [];

    }



  /*   if (eventData.diagnosis2) {

    	airFields["Diagnosis2"] = [eventData.diagnosis2];

    } else {

    	airFields["Diagnosis2"] = [];

    } */


	
    // add here warranty diagnosis extensions of issue 
    airFields = {
 
    "Status": status,
    "Status (linkable)":statusLinked,
    "field_ID": eventData.id,
    "Group": group,
    "Subject": eventData.subject,
    "Created": eventData.created,
    "Frame": eventData.frame,
    "Workshop": [getRecordId(eventData.workshop, workshopsMapping)],
    "Partner Workshop": ticketAPIdata.partnerWorkshop,
    "Diagnosis 1": ticketAPIdata.diagnosis1,
    "Tags": tagsArray,
    "Diagnosis 2": ticketAPIdata.diagnosis2,
    "Assignee": [getRecordId(eventData.assignee, assigneeMapping)],
    "Model": eventData.model,
    "Last updated generic": eventData.lastupdatedgeneric,
    "Description": eventData.description,
    "Priority": eventData.priority, 
    "Open time": timeValues.openTime,
    "Pending time": timeValues.pendingTime,
    "Resolved time": timeValues.resolvedTime,
    "Workshop order": timeValues.workshopOrderTime,
    "Workshop visit": timeValues.workshopVisitTime,
    "Workshop arrived": timeValues.workshopArrivedTime,
    "Repair in process": timeValues.repairInProcessTime,
    "Repaired time": timeValues.repairedTime,
    "Package ready": timeValues.packageReadyTime,
    "Shipped to Customer": timeValues.shippedToCustomerTime,
    "Closed": timeValues.closedTime,
    "FD link": eventData.fdlink,
    "sub-category-1": ticketAPIdata.sub_cat_1, 
    "sub-category-2": ticketAPIdata.sub_cat_2,
    "issue-1": ticketAPIdata.issue_1,
    "issue-2": ticketAPIdata.issue_2,
    "Bike model": ticketAPIdata.bikeModel
  
};



    

    for (const field in airFields) {
        if (airFields[field] !== null && airFields[field] !== "" && airFields[field] !== undefined) {
            if (Array.isArray(airFields[field]) && airFields[field].length === 1 && airFields[field][0] === null) {
                continue;
            }
            airFieldsToUpdate[field] = airFields[field];
        }
    }

    
    
return airFieldsToUpdate;

}





function getRecordId(name, map) {
    // Check if the name exists in the mapping. This is needed to linked fields in Airtable, as Freshdesk sends the string variant
    // but in Airtable, a linked field needs to be addressed via its ID and thus maps need to be created to find the correct field ID
    // and then use it in prepFieldsForUpdate();

    if (map.hasOwnProperty(name)) {
        console.log(name, "Record:", map[name]);
        return map[name]; // Return the corresponding record ID


    } else {
        console.log(`Record for '${name}' not found in mapping` + " " + map);
        return null 
    }
}


// Updated fetchFullRecords Function
async function fetchFullRecords(apiUrl, map) {
    try {
        const requestOptions = {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${personalAccessToken}`
            }
        };

        const response = await fetch(apiUrl, requestOptions);
        const responseData = await response.json();

        if (responseData.records && responseData.records.length > 0) {
            responseData.records.forEach(record => {
                const recordId = record.id;
                const Name = record.fields.Name;
                map[Name] = recordId;
            });
        } else {
            console.log("List not found in fetchFullRecords");
        }

        return Promise.resolve();
    } catch (error) {
        console.error('Error fetching Airtable list via fetchFullRecords:', error);
        return Promise.reject(error);
    }
}

// Updated fetchAirtableEntry Function
async function fetchAirtableEntry(fieldIdValue) {
    const requestOptions = {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${personalAccessToken}`
        }
    };

    const apiUrl = `https://api.airtable.com/v0/${baseId}/Tickets?fields%5B%5D=field_ID&fields%5B%5D=Status&filterByFormula=AND(%7Bfield_ID%7D%3D'${fieldIdValue}')&maxRecords=1`;

    try {
        const response = await fetch(apiUrl, requestOptions);
        const responseData = await response.json();

        if (responseData.records && responseData.records.length > 0) {
        	console.log("Im in fetchAirtable IF", responseData);
            const entryData = responseData.records[0];
            
            return entryData




        } else {
            console.log("id not found, frome fd", fieldIdValue);
            return null
        }
    } catch (error) {
        console.error('Error fetching Airtable entry:', error);
    }
}

// Updated fetchFdEntry Function
async function fetchFdEntry(id) {
    const requestOptions = {
        method: 'GET',
        headers: {
            'Authorization': `Basic ${fdKey}`
        }
    };

    

    const apiUrl = `https://amplerbikes.freshdesk.com/api/v2/tickets/${id}`;

    console.log("API URL FOR FRESHDESK FETCH:", apiUrl);

    try {
        const response = await fetch(apiUrl, requestOptions);
        const responseData = await response.json();

        if (responseData) {

            ticketAPIdata = {
            
            created:responseData.created_at,
            updated:responseData.updated_at,
            sub_cat_1:responseData.custom_fields.cf_categroy,
            sub_cat_2:responseData.custom_fields.cf_subcategory537248,
            issue_1:responseData.custom_fields.cf_subcategory,
            issue_2:responseData.custom_fields.cf_issue364580,
            bikeModel:responseData.custom_fields.cf_specify,
            diagnosis1: responseData.custom_fields.cf_warranty_issue,
            diagnosis2: responseData.custom_fields.cf_warranty_diagnosis_2,
            partnerWorkshop: responseData.custom_fields.cf_workshop


            };

    

            //console.log("Fetched separately from ticket diagnosis: ", ticketAPIdata);

            

            console.log(ticketAPIdata);
            return { ticketAPIdata };
        } else {
            console.log("id not found, frome fd", id);
        }
    } catch (error) {
        console.error('Error fetching Freshdesk entry:', error);
    }
}

/* const testId = "216840";
fetchFdEntry(testId); */


// Updated updateEntry Function
async function updateEntry(id, fieldsToUpdate) {
    const apiUrl = `https://api.airtable.com/v0/${baseId}/${tableName}/${id}`;

    const requestOptions = {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${personalAccessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            fields: fieldsToUpdate
        })
    };

    try {
        const response = await fetch(apiUrl, requestOptions);

        if (!response.ok) {
            airTableErrorCheck = true;
            console.error(`Update entry request failed, !response.ok with status ${response.status}`);
            return response.json();
        }

        return response.json();
    } catch (error) {
        console.error('Error updating Airtable entry:', error);
        throw error;
    }
}

// Updated createAirtableEntry Function
async function createAirtableEntry(fieldsToCreate) {
    const apiUrl = `https://api.airtable.com/v0/${baseId}/${tableName}`;

    const requestOptions = {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${personalAccessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            fields: fieldsToCreate
        }),
        typecast: true // Enable typecasting
    };

    try {
        const response = await fetch(apiUrl, requestOptions);

        if (!response.ok) {
            airTableErrorCheck = true;
            console.error(`Create entry request failed, !response.ok with status ${response.status}`);

        }

        return response.json();
    } catch (error) {
        console.error('Error creating Airtable entry:', error);
        throw error;
    }
}










function setTimeValues(statusInput, currentStatus) {

// this is necessary for Airtable calculations of each status on how much time it took for mechanics.
// I generate timestamp of when it went to each status and pass it to Airtable. 



timeValues = {
        resolvedTime: "",
        pendingTime: "",
        openTime: "",
        workshopOrderTime: "",
        workshopArrivedTime: "",
        repairedTime: "",
        shippedToCustomerTime: "",
        closedTime: "",
        packageReadyTime: "",
        repairInProcessTime: "",
        workshopVisitTime: ""
    };
    // here we have to add extra checks for technical support group as Freshdesk webhook order is broken. It ignores the rule to include only
    // warrant, service and accounting groups when automation is triggered for Türi workshop to set it to "open" and "tech support" when it goes to "Warranty" and "3 repaired". This
    // sends out the hook still with wrong group and breaks the sync. So we catch it, replace it with what it was initially with "Warranty" and then to " 3 repaired"
     if (statusInput === "Pending") {
        timeValues.pendingTime = dateTime;
    } else if (statusInput === "Open" && eventData.group !== "Technical Support") {
        timeValues.openTime = dateTime;
    } else if (statusInput === "Resolved") {
        timeValues.resolvedTime = dateTime;
    } else if (statusInput === "Workshop order") {
        timeValues.workshopOrderTime = dateTime;
    } else if (statusInput === "1 Workshop arrived") {
        timeValues.workshopArrivedTime = dateTime;
    } else if (statusInput === "3 Repaired") {
        timeValues.repairedTime = dateTime;
    } else if (statusInput === "5 Shipped to customer") {
        timeValues.shippedToCustomerTime = dateTime;
    } else if (statusInput === "Closed") {
        timeValues.closedTime = dateTime;
    } else if (statusInput === "4 Package ready") {
        timeValues.packageReadyTime = dateTime;
    } else if (statusInput === "2 Repair in process") {
        timeValues.repairInProcessTime = dateTime;
    } else if (statusInput === "Workshop visit") {
        timeValues.workshopVisitTime = dateTime;
    } else if (statusInput === "Open" && eventData.group === "Technical Support") {
    	timeValues.repairedTime = dateTime;
    }
    // Check if new status is the same as the current status
    if (statusInput === currentStatus) {
    	console.log("The status is the same!!!!")
        for (const key in timeValues) {
            timeValues[key] = "";
        }
    }
    console.log ("THESE ARE TIMEVALUES before returning", timeValues)
    return timeValues;
    
    
}





function mainFunction() {

// The chain I call when the app gets a payload from Freshdesk. First, we fetch all possible workshops from Airtable.
// Airtable expects the value to be set in a single select field, so it declines any new values
// we need the mapping because of linked fields. The actual field value is a hash and thus must be mapped first when linked fields are used in Airtable
// Then we get all the possible statuses
// then we proceed to update Airtable, as all data is now present. 

	
    fetchFullRecords(workshopsApi, workshopsMapping)
        .then(() => fetchFullRecords(assigneeApi, assigneeMapping))
        .then(() => fetchFullRecords(statusApi, statusMapping))
        .then(() => fetchFdEntry(ticketID))

        .then(() => {
           
            console.log(assigneeMapping, workshopsMapping, statusMapping);
            updateAirtable(); 
        })
        .catch(error => {
            

            console.error('Error:', error);

            log = {
				    time: dateTime,
				    id: "Ticket: " + ticketID,
				    status: " Status: " + entryData.status,
				    response: " failed to fetch full records: " + error
    			};
    		latestLogData.logs.push(log); 


        });
}





async function updateAirtable() {
  airTableErrorCheck = false;

  try {
    const dataAirtable = await fetchAirtableEntry(ticketID);
   

    if (!dataAirtable) {
      // Ticket ID not found, proceed to create one
      console.log('Ticket ID not found, proceeding to create one to Airtable:', ticketID);
      const timeValues = setTimeValues(statusInput, "");
      const updatedFields = prepFieldsForUpdate(timeValues);
      const responseData = await createAirtableEntry(updatedFields);
      console.log("Response after creating to Airtable: ", responseData)

      if (airTableErrorCheck) {
        log = {
          time: dateHuman,
          id: ticketID,
          shop: eventData.workshop,
          frame: eventData.frame,
          status: " Status: " + statusInput,
          response: " Failed to create to Airtable: " + responseData.error.message + responseData.error.type,
          isError: true
        };
      } else {
        log = {
          time: dateHuman,
          id: ticketID,
          shop: eventData.workshop,
          frame: responseData.fields.Frame,
          status: " Status: " + responseData.fields.Status,
          response: " created to Airtable",
          isError: false
        };
      }

      pushLog(log);
    } else {

	    const recordAirtable = dataAirtable.id;
		const statusAirtable = dataAirtable.fields.Status;
		const frameAirtable = dataAirtable.fields.Frame

      // Entry found, update it
      console.log("Entry found, udating Airtable")
      const timeValues = setTimeValues(statusInput, statusAirtable);
      const updatedFields = prepFieldsForUpdate(timeValues);
      const responseData = await updateEntry(recordAirtable, updatedFields);
      console.log("Response after updating to Airtable: ", responseData)

      if (airTableErrorCheck) {
        log = {
          time: dateHuman,
          id: ticketID,
          shop: eventData.workshop,
          frame: frameAirtable,
          status: " Status: " + statusInput,
          response: " failed to update to Airtable: " + responseData.error.message + responseData.error.type,
          isError: true
        };
      } else {
        log = {
          time: dateHuman,
          id: ticketID,
          shop: eventData.workshop,
          frame: frameAirtable,
          status: " Status: " + statusAirtable,
          response: " updated to Airtable",
          isError: false
        };
      }

      pushLog(log);
    }
  } catch (error) {
    console.error('Error updateAirtable:', error);

    log = {
      time: dateHuman,
      id: ticketID,
      shop: eventData.workshop,
      frame: eventData.frame,
      status: " Status: " + statusInput,
      response: " failed to update/create to Airtable: " + error,
      isError: true
    };

    pushLog(log);
  }
}




app.post('/webhook', (req, res) => {

	console.log('Received webhook RAW RAW RAW:', req.body);

//here we wait for Freshdesk to send data and then commence whole app flow by calling mainFunction();

    const data = req.body;
    

    if (data) {

        console.log('Received webhook data:', data);
        getCurrentDateTime();
        
        eventData = data;
        ticketID = data.id;
        statusInput = data.status
        


        
        mainFunction();
    	
        res.status(200).send('Webhook received and processed successfully');


    } else {
        // If the received data does not contain the necessary information
        console.log('Webhook data does not contain ticket information');
        res.status(400).send('Invalid webhook data');
    }


});





app.get('/api/data', (req, res) => {
    // Prepare your data here
    res.json(latestLogData);
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});



