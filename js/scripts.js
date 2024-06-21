document.addEventListener("DOMContentLoaded", function() {
    console.log("DOM fully loaded and parsed");

    const activities = {};
    let weeklyCost = 0;

    // Manejo del formulario para agregar actividades
    document.getElementById("activityForm").addEventListener("submit", function(event) {
        event.preventDefault();
        
        const activity = document.getElementById("activity").value.trim();
        const description = document.getElementById("description").value.trim();
        const predecessors = document.getElementById("predecessors").value.split(',').map(p => p.trim()).filter(p => p);

        if (activities[activity]) {
            alert(`La actividad ${activity} ya existe.`);
            return;
        }

        activities[activity] = { description, predecessors: predecessors.length ? predecessors : ['-'], t: 0, variance: 0, ES: 0, EF: 0, LS: 0, LF: 0, slack: 0, isCritical: false, cost: 0 };

        document.getElementById("activityForm").reset();
        displayActivities();
    });

    // Manejo del formulario para agregar estimaciones de tiempo
    document.getElementById("timeEstimateForm").addEventListener("submit", function(event) {
        event.preventDefault();
        
        const activity = document.getElementById("estimateActivity").value.trim();
        const optimista = parseFloat(document.getElementById("optimistic").value);
        const probable = parseFloat(document.getElementById("mostLikely").value);
        const pesimista = parseFloat(document.getElementById("pessimistic").value);

        if (activities[activity]) {
            const t = (optimista + 4 * probable + pesimista) / 6;
            const variance = Math.pow((pesimista - optimista) / 6, 2);
            const cost = t * weeklyCost;
            activities[activity].optimista = optimista;
            activities[activity].probable = probable;
            activities[activity].pesimista = pesimista;
            activities[activity].t = t;
            activities[activity].variance = variance;
            activities[activity].cost = cost;
        } else {
            alert(`La actividad ${activity} no existe. Por favor, agréguela primero.`);
            return;
        }

        document.getElementById("timeEstimateForm").reset();
        displayTimeEstimates();
    });

    // Manejo del formulario para agregar costo por semana
    document.getElementById("costForm").addEventListener("submit", function(event) {
        event.preventDefault();
        weeklyCost = parseFloat(document.getElementById("weeklyCost").value);
        alert(`Costo por semana actualizado a ${weeklyCost}`);
        displayTimeEstimates();
    });

    function displayActivities() {
        const tableBody = document.getElementById("activityTable");
        tableBody.innerHTML = '';
        for (const key in activities) {
            const activity = activities[key];
            const row = `
                <tr>
                    <td>${key}</td>
                    <td>${activity.description}</td>
                    <td>${activity.predecessors.includes('-') ? '-' : activity.predecessors.join(', ')}</td>
                </tr>
            `;
            tableBody.insertAdjacentHTML("beforeend", row);
        }
    }

    function displayTimeEstimates() {
        const tableBody = document.getElementById("timeEstimates");
        tableBody.innerHTML = '';
        for (const key in activities) {
            const activity = activities[key];
            const row = `
                <tr>
                    <td>${key}</td>
                    <td>${activity.optimista ?? ''}</td>
                    <td>${activity.probable ?? ''}</td>
                    <td>${activity.pesimista ?? ''}</td>
                    <td>${activity.t.toFixed(2)}</td>
                    <td>${activity.variance.toFixed(2)}</td>
                    <td>${activity.cost.toFixed(2)}</td>
                </tr>
            `;
            tableBody.insertAdjacentHTML("beforeend", row);
        }
    }

    function calculateCriticalPath() {
        console.log("Calculando la ruta crítica...");

        for (const key in activities) {
            activities[key].ES = activities[key].predecessors.includes('-') ? 0 : Math.max(...activities[key].predecessors.map(p => activities[p].EF));
            activities[key].EF = activities[key].ES + activities[key].t;
        }

        for (const key in activities) {
            const activity = activities[key];
            if (!activity.predecessors.includes('-')) {
                for (const successorKey in activities) {
                    const successor = activities[successorKey];
                    if (successor.predecessors.includes(key)) {
                        successor.ES = Math.max(successor.ES, activity.EF);
                        successor.EF = successor.ES + successor.t;
                    }
                }
            }
        }

        const projectDuration = Math.max(...Object.values(activities).map(a => a.EF));
        for (const key in activities) {
            activities[key].LF = projectDuration;
            activities[key].LS = activities[key].LF - activities[key].t;
        }

        const activityKeys = Object.keys(activities).reverse();
        for (const key of activityKeys) {
            const activity = activities[key];
            if (!activity.predecessors.includes('-')) {
                for (const predecessorKey of activity.predecessors) {
                    const predecessor = activities[predecessorKey];
                    if (predecessor) {
                        predecessor.LF = Math.min(predecessor.LF, activity.LS);
                        predecessor.LS = predecessor.LF - predecessor.t;
                    }
                }
            }
        }

        for (const key in activities) {
            const activity = activities[key];
            activity.slack = activity.LS - activity.ES;
            activity.isCritical = activity.slack === 0;
        }
    }

    function displayCriticalPath() {
        const tableBody = document.getElementById("criticalPath");
        tableBody.innerHTML = '';
        for (const key in activities) {
            const activity = activities[key];
            const row = `
                <tr${activity.isCritical ? ' class="table-danger"' : ''}>
                    <td>${key}</td>
                    <td>${activity.ES.toFixed(2)}</td>
                    <td>${activity.EF.toFixed(2)}</td>
                    <td>${activity.LS.toFixed(2)}</td>
                    <td>${activity.LF.toFixed(2)}</td>
                    <td>${activity.slack.toFixed(2)}</td>
                </tr>
            `;
            tableBody.insertAdjacentHTML("beforeend", row);
        }
    }

    function createGanttChart() {
        const ganttData = Object.keys(activities).map(key => {
            return {
                task: key,
                startTime: activities[key].ES,
                endTime: activities[key].EF,
                isCritical: activities[key].isCritical
            };
        });

        const margin = { top: 20, right: 20, bottom: 30, left: 40 },
              width = 960 - margin.left - margin.right,
              height = 500 - margin.top - margin.bottom;

        const svg = d3.select("#ganttChart")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleLinear()
            .domain([0, d3.max(ganttData, d => d.endTime)])
            .range([0, width]);

        const y = d3.scaleBand()
            .domain(ganttData.map(d => d.task))
            .range([0, height])
            .padding(0.1);

        svg.append("g")
            .attr("class", "x axis")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x));

        svg.append("g")
            .attr("class", "y axis")
            .call(d3.axisLeft(y));

        const bars = svg.selectAll(".bar")
            .data(ganttData)
            .enter()
            .append("rect")
            .attr("class", "bar")
            .attr("x", d => x(d.startTime))
            .attr("y", d => y(d.task))
            .attr("width", d => x(d.endTime) - x(d.startTime))
            .attr("height", y.bandwidth())
            .attr("fill", d => d.isCritical ? "red" : "blue");
    }

    function createPertChart() {
        const nodes = [];
        const links = [];
        const nodePositions = {
            'Inicio': { x: 50, y: 100 },
            'A': { x: 250, y: 100 },
            'B': { x: 250, y: 300 },
            'C': { x: 450, y: 100 },
            'D': { x: 450, y: 300 },
            'E': { x: 650, y: 100 },
            'F': { x: 650, y: 300 },
            'G': { x: 850, y: 100 },
            'H': { x: 850, y: 300 },
            'Fin': { x: 1050, y: 200 },
        };

        nodes.push({ id: 'Inicio', label: 'Inicio', description: '', duration: 0 });
        nodes.push({ id: 'Fin', label: 'Fin', description: '', duration: 0 });

        Object.keys(activities).forEach(key => {
            const activity = activities[key];
            nodes.push({ id: key, label: key, description: activity.description, duration: activity.t });

            if (activity.predecessors.includes('-')) {
                links.push({ source: 'Inicio', target: key });
            }

            activity.predecessors.forEach(predecessor => {
                if (predecessor !== '-') {
                    links.push({ source: predecessor, target: key });
                }
            });

            if (!Object.values(activities).some(act => act.predecessors.includes(key))) {
                links.push({ source: key, target: 'Fin' });
            }
        });

        const width = 1200, height = 500;

        const svg = d3.select("#pertChart")
            .append("svg")
            .attr("width", width)
            .attr("height", height);

        const link = svg.append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(links)
            .enter().append("line")
            .attr("stroke-width", 2)
            .attr("marker-end", "url(#arrow)");

        const node = svg.append("g")
            .attr("class", "nodes")
            .selectAll("g")
            .data(nodes)
            .enter().append("g")
            .attr("transform", d => `translate(${nodePositions[d.id].x},${nodePositions[d.id].y})`);

        node.append("rect")
            .attr("width", 150)
            .attr("height", 50)
            .attr("rx", 5)
            .attr("ry", 5)
            .attr("fill", "lightblue");

        node.append("text")
            .attr("dy", 20)
            .attr("dx", 75)
            .attr("text-anchor", "middle")
            .text(d => `${d.label}: ${d.description}`);

        node.append("text")
            .attr("dy", 40)
            .attr("dx", 75)
            .attr("text-anchor", "middle")
            .text(d => `Duración: ${d.duration}`);

        svg.append("defs").append("marker")
            .attr("id", "arrow")
            .attr("viewBox", "0 -5 10 10")
            .attr("refX", 15)
            .attr("refY", 0)
            .attr("markerWidth", 6)
            .attr("markerHeight", 6)
            .attr("orient", "auto")
            .append("path")
            .attr("d", "M0,-5L10,0L0,5")
            .attr("class", "arrowHead");

        link
            .attr("x1", d => nodePositions[d.source].x + 75)
            .attr("y1", d => nodePositions[d.source].y + 25)
            .attr("x2", d => nodePositions[d.target].x + 75)
            .attr("y2", d => nodePositions[d.target].y + 25);
    }

    document.getElementById("calculateCriticalPathBtn").addEventListener("click", function() {
        calculateCriticalPath();
        displayCriticalPath();
        createGanttChart();
        createPertChart();
    });
});
