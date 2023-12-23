let probChart = null; // Global variable to hold the chart instance

document.getElementById('image-form').addEventListener('submit', function(e) {
    e.preventDefault();
    let formData = new FormData(this);
    let submitButton = document.querySelector("#image-form button[type='submit']");

    // Disable the submit button and show the spinner
    submitButton.disabled = true;
    document.getElementById('spinner').style.display = 'block';

    // Display the mini image
    let imageInput = document.getElementById('image');
    if (imageInput.files && imageInput.files[0]) {
        let reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('processedImage').src = e.target.result;
        };
        reader.readAsDataURL(imageInput.files[0]);
    }

    fetch('/process', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        console.log(data)
        // Enable the submit button and hide the spinner
        submitButton.disabled = false;
        document.getElementById('spinner').style.display = 'none';

        if (data.predictions) {
            displayPredictions(data.predictions, data.inference_time);
        } else if (data.benchmark) {
            displayBenchmark(data.benchmark);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        // Enable the submit button in case of an error
        submitButton.disabled = false;
        document.getElementById('spinner').style.display = 'none';
    });
});

function displayPredictions(predictions, inferenceTime) {
    const processedImageContainer = document.getElementById('processedImageContainer');
    const probGraphContainer = document.getElementById('probGraphContainer');

    processedImageContainer.style.display = 'block';
    probGraphContainer.style.display = 'block';

    // Display the mini image
    let imageInput = document.getElementById('image');
    if (imageInput.files && imageInput.files[0]) {
        let reader = new FileReader();
        reader.onload = function(e) {
            let processedImage = document.getElementById('processedImage');
            if (processedImage) {
                processedImage.src = e.target.result;
                processedImage.style.maxWidth = '450px'; // Adjust width as needed
                processedImage.style.height = 'auto'; // Maintain aspect ratio
            }
        };
        reader.readAsDataURL(imageInput.files[0]);
    }

    // Render prediction probabilities graph
    renderProbGraph(predictions);

    // Update the inference time container
    let inferenceTimeDiv = document.getElementById('inferenceTime');
    if (inferenceTimeDiv) {
        // Remove the element
        inferenceTimeDiv.remove();

        // Create a new div element for inference time
        let newInferenceTimeDiv = document.createElement('div');
        newInferenceTimeDiv.id = 'inferenceTime';
        newInferenceTimeDiv.className = 'inference-time-container';
        newInferenceTimeDiv.innerHTML = `Inference Time: ${inferenceTime.toFixed(2)} ms`;

        // Re-add the element to the DOM
        let probGraphContainer = document.getElementById('probGraphContainer');
        probGraphContainer.appendChild(newInferenceTimeDiv);
    }
    // Update the inference time container
    let topPrediction = document.getElementById('topPrediction');
    if (topPrediction) {
        // Remove the element
        topPrediction.remove();

        // Create a new div element for inference time
        let newTopPrediction = document.createElement('div');
        newTopPrediction.id = 'topPrediction';
        newTopPrediction.className = 'top-prediction-container';
        newTopPrediction.innerHTML = `ResNet50 thinks it is: ${predictions[0].label}`;

        // Re-add the element to the DOM
        let probGraphContainer = document.getElementById('probGraphContainer');
        probGraphContainer.appendChild(newTopPrediction);
    }
}

function renderProbGraph(predictions) {
    const ctx = document.getElementById('probGraph').getContext('2d');

    // Destroy the existing chart if it exists
    if (probChart) {
        probChart.destroy();
    }

    const labels = predictions.map(prediction => prediction.label);
    const probs = predictions.map(prediction => (prediction.confidence * 100).toFixed(2)); // Convert to percentage

    // Define a blue-purple color palette
    const bluePurplePalette = [
        'rgba(63, 81, 181, 0.8)', // Blue
        'rgba(94, 53, 177, 0.8)', // Indigo
        'rgba(123, 31, 162, 0.8)', // Deep Purple
        'rgba(156, 39, 176, 0.8)', // Purple
        'rgba(186, 104, 200, 0.8)' // Light Purple
    ];

    // Assign colors from the palette to each bar
    const backgroundColors = probs.map((_, index) => bluePurplePalette[index % bluePurplePalette.length]);

    probChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Confidence (%)',
                data: probs,
                backgroundColor: backgroundColors,
                borderColor: backgroundColors.map(color => color.replace('0.8', '1')), // Darker border color
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y', // Set to 'y' for horizontal bars
            scales: {
                x: {
                    beginAtZero: true
                }
            }
        }
    });
}

function randomRGB() {
    return Math.floor(Math.random() * 255);
}

function displayBenchmark(benchmarkResults) {
    // Hide the image and prediction graph containers
    document.getElementById('processedImageContainer').style.display = 'none';
    document.getElementById('probGraphContainer').style.display = 'none';

    // Prepare data for line graphs
    const labels = Object.keys(benchmarkResults);
    const times = labels.map(label => benchmarkResults[label][0]);
    const throughputs = labels.map(label => benchmarkResults[label][1]);

    // Display line graphs
    displayLineGraph(labels, times, throughputs);
}

function displayLineGraph(labels, times, throughputs) {
    document.getElementById('lineGraphContainer').style.display = 'block';

    // Colors from the blue-purple palette
    const timeGraphColor = 'rgba(103, 58, 183, 0.8)'; // Purple
    const throughputGraphColor = 'rgba(63, 81, 181, 0.8)'; // Blue

    // Inference Time Graph
    const timeCtx = document.getElementById('timeGraph').getContext('2d');
    new Chart(timeCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Average Inference Time (ms)',
                data: times,
                backgroundColor: timeGraphColor,
                borderColor: timeGraphColor.replace('0.8', '1'),
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                x: {
                    beginAtZero: true
                }
            }
        }
    });

    // Throughput Graph
    const throughputCtx = document.getElementById('throughputGraph').getContext('2d');
    new Chart(throughputCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Average Throughput (samples/sec)',
                data: throughputs,
                backgroundColor: throughputGraphColor,
                borderColor: throughputGraphColor.replace('0.8', '1'),
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                x: {
                    beginAtZero: true
                }
            }
        }
    });
}

function updateModelOptions() {
    const modeSelect = document.getElementById('mode');
    const modelSelect = document.getElementById('model');

    // Clear existing options
    modelSelect.innerHTML = '';

    if (modeSelect.value === 'predict') {
        // Options for 'Predict' mode
        const options = ['ov', 'pytorch', 'onnx'];
        options.forEach(opt => {
            let option = document.createElement('option');
            option.value = opt;
            option.text = opt.toUpperCase(); // Capitalize first letter
            modelSelect.appendChild(option);
        });
    } else if (modeSelect.value === 'benchmark') {
        // Only 'ALL' option for 'Benchmark' mode
        let option = document.createElement('option');
        option.value = 'all';
        option.text = 'ALL';
        modelSelect.appendChild(option);
    }
}
