


const refreshButton = document.getElementById("refresh");


function fetchData() {
    fetch('/api/data')
        .then(response => response.json())
        .then(data => {
            // Update DOM elements with the fetched data
            const logsContainer = document.getElementById("logsContainer");
            logsContainer.innerHTML = ""; // Clear previous logs before adding new ones

            
            // Loop through the logs array in reverse order and create a <div> for each log
            for (let i = data.logs.length - 1; i >= 0; i--) {
                const log = data.logs[i];

                const logDiv = document.createElement("div");
                const timeSpan = document.createElement("span");
                const idSpan = document.createElement("span");
                const statusSpan = document.createElement("span");
                const responseSpan = document.createElement("span");
                const shopSpan = document.createElement("span");
                const frameSpan = document.createElement("span");
                const idUrl = document.createElement('a')


                timeSpan.textContent = log.time;
                idUrl.textContent = log.id; // Display the ticket ID as link text
                idUrl.href = `https://support.amplerbikes.com/a/tickets/${log.id}`;
                idUrl.setAttribute('target', '_blank');
                statusSpan.textContent = log.status;
                responseSpan.textContent = log.response;
                shopSpan.textContent = log.shop;
                frameSpan.textContent = log.frame;



                logDiv.appendChild(timeSpan);
                logDiv.appendChild(idSpan);
                logDiv.appendChild(statusSpan);
                logDiv.appendChild(shopSpan);
                logDiv.appendChild(frameSpan);
                logDiv.appendChild(responseSpan);
                idSpan.appendChild(idUrl);

                logsContainer.appendChild(logDiv);


                
                


                if (log.isError) {

                    logDiv.className = "error-item";

                } else {

                    logDiv.className = "normal-item";
                }
            }
            console.log("Logs array length: ", data.logs.length )
        })
        .catch(error => {
            console.error('Error fetching data:', error);
        });

        refreshButton.disabled = false;
        refreshButton.classList.remove("btn-disabled");
      
}




document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    
});




function refresh() {

    refreshButton.disabled = true;
    refreshButton.classList.add("btn-disabled");

    
    console.log("refreshed")
    fetchData();
  
    
}


setInterval(refresh(), 300000);

