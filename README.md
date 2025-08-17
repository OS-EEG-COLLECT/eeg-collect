<div align="center">

  <img src="assets/logo.png" alt="logo" width="200" height="auto" />
  <h1>Wellenkern STREAMS</h1>
  
  <p>
    A web-based platform for bio-signal data collection using Wellenkern BURSTS EEG Headphones. 
  </p>
  
  
<!-- Badges -->
<p>
  <a href="https://github.com/Louis3797/awesome-readme-template/graphs/contributors">
    <img src="https://img.shields.io/github/contributors/OS-EEG-COLLECT/eeg-collect" alt="contributors" />
  </a>
  <a href="">
    <img src="https://img.shields.io/github/last-commit/OS-EEG-COLLECT/eeg-collect" alt="last update" />
  </a>
  <a href="https://github.com/OS-EEG-COLLECT/eeg-collect/network/members">
    <img src="https://img.shields.io/github/forks/OS-EEG-COLLECT/eeg-collect" alt="forks" />
  </a>
  <a href="https://github.com/OS-EEG-COLLECT/eeg-collect/stargazers">
    <img src="https://img.shields.io/github/stars/OS-EEG-COLLECT/eeg-collect" alt="stars" />
  </a>
  <a href="https://github.com/OS-EEG-COLLECT/eeg-collect/issues/">
    <img src="https://img.shields.io/github/issues/OS-EEG-COLLECT/eeg-collect" alt="open issues" />
  </a>
  <a href="https://github.com/OS-EEG-COLLECT/eeg-collect/blob/master/LICENSE">
    <img src="https://img.shields.io/github/license/OS-EEG-COLLECT/eeg-collect.svg" alt="license" />
  </a>
</p>
   
<h4>
    <a href="https://github.com/OS-EEG-COLLECT/eeg-collect/issues/">Report Bug</a>
  <span> · </span>
    <a href="https://github.com/OS-EEG-COLLECT/eeg-collect/issues/">Request Feature</a>
  </h4>
</div>

<br />

> [!NOTE]  
> This project is the repository for the following paper.
> If you want to use this project, please cite it using:
> 
> Stingl, L., & Knierim, M. T. (2024). OpenBCI meets the web: A scalable, customizable platform for open-source EEG data collection. In Companion of the 2024 ACM International Joint Conference on Pervasive and Ubiquitous Computing (UbiComp Companion ’24) (pp. 1-5). ACM. https://doi.org/10.1145/3675094.3678482
> 
> Please note that the codebase has continued to evolve with additional features and enhancements. As a result, it may differ from the implementation described in the linked paper.



<br />


<!-- About the Project -->
## :information_source: About the Project


<!-- Screenshots -->

<div align="center"> 
  <img src="https://placehold.co/600x400?text=Your+Screenshot+here" alt="screenshot" />
</div>

<br />

Weelenkern STREAMS provides a customizable, user-friendly platform for EEG data collection based on OpenBCI hardware.
It streamlines the setup process and supports versatile electrode configurations, making EEG-based BCI research more accessible.
The Vue 3 and D3.js frontend offers real-time impedance feedback during the setup phase, helping the user establish a stable connection with Wellenkern BURSTS,
while the backend — built with Apache, Node.js, and Flask — handles efficient data transmission and storage.
Designed for cross-platform compatibility and efficient session management,
the platform is well-suited for large-scale and field studies, offering automated data management and real-time feedback to enhance data quality and reliability.

<!-- Key Features -->
### Key Features

| Feature                                      | Description                                                                                                                                                                                             |
|-----------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Accessible GUI for EEG data collection        | User-friendly interface guides users through headset setup, ensures good signal quality, and automates data processing and saving, enabling high-quality data collection in the field.                  |
| Real-time impedance checks for electrode stability | Provides real-time, color-coded impedance feedback to help users ensure electrodes are properly connected and stable, making it easy to identify and resolve connection issues — even in field studies. |
| Customizable electrode configurations         | Supports a range of predefined or custom electrode configurations, allowing researchers to adapt the setup to their specific needs and ensuring flexibility in data collection.                         |
| Efficient data transmission and storage       | Utilizes Node.js and Flask for efficient data transmission and storage via WebSocket, enabling low-latency, high-throughput data handling and easy access for further analysis.                         |

<br />

<!-- Getting Started -->
## 	:hammer: Getting Started

> [!NOTE]  
> This project requires Node.js and npm to be installed on your machine. You can download them from [Node.js's official website](https://nodejs.org/).
> Aditionally, pip is required for the Flask server. You can download it from [pip's official website](https://pip.pypa.io/en/stable/).


<!-- Installation -->
### 1. Clone Repository

Install my-project with npm

```bash
  git clone https://github.com/OS-EEG-COLLECT/eeg-collect.git
  cd eeg-collect
```
   
<!-- Install Dependencies -->
### 2. Install Dependencies

1. To install the frontend and backend dependencies, navigate to the `frontend/` and `backend/` directories respectively and run:
      ```bash
        npm install
      ```

2. Finally, install the Flask server dependencies by navigating to the `impedance/` directory and running:
      ```bash
        pip install -r requirements.txt
      ```

<!-- Adjust the Backend Server URL in the Frontend Module -->
### 3. Adjust the Backend Server URL in the Frontend Module

During data recording, the frontend service continuously streams signal data to the backend server.
To ensure that the frontend can communicate with the backend, you need to adjust the backend server URL in the frontend module.
<br /> To do so, open the `frontend/src/utils/helpers.ts` file, and set the `WEB_SOCKET_URL` property of the `URLs` object to your server:

**A. If you have [deployed your own server](#cloud-deployment):**

- The `WEB_SOCKET_URL` should point to your backend server's WebSocket URL. For example:

    ```typescript
    export const URLs = { WEB_SOCKET_URL: "wss://exg.iism.kit.edu/websocket/" };
    ```
**B. For local development**
- For development purposes, the server is run locally. The default port is `3000`, but you can change it to your desired port.
Remember to ensure that you start the backend server on the specified port.
    ```typescript
    export const URLs = { WEB_SOCKET_URL: "ws://localhost:3000/websocket/" };
    ```


<br />

<!-- Usage -->
## :headphones: Usage

### 1. Start the Services
To start the services, execute the following commands in separate terminal instances:
1. **Frontend**:  
   Navigate to the `frontend/` directory and run:
   ```bash
   npm run serve
   ```
2. **Backend**:  
   Navigate to the `backend/` directory and run:
   ```bash
   node websocket.js
   ```
3. **Flask Server**:
    Navigate to the `impedance/` directory and run:
    ```bash
    python bandfilter.py
    ```


### 2. Access the Web App

The starting point for the web app is the `setup-device/` route, which allows you to connect your wearable device and start a recording session.
To start using the web app, open the following URL in your browser. Please replace the placeholders with your actual values:

```
http://localhost:8080/setup-device?aHCWFRZvlU=[access_key]&AbXHPCkszw=[your_session_name]&wlmtdoqtqe=[headset_configuration]
```
#### Query Parameters Explained

| Parameter        | Description                                                                                                   |
|------------------|--------------------------------------------------------------------------------------------------------------|
| `aHCWFRZvlU`     | **Access Key (Guard):** Required to access the web app. Contact the developer to receive your access key.    |
| `AbXHPCkszw`     | **Session Name:** Name of your recording session. All generated files will be prefixed with this name.        |
| `wlmtdoqtqe`     | **Configuration:** EEG headset configuration. Use any uppercase letter from `A` to `I` for electrode setup.   |


The Web App will guide you through the setup process, including connecting your Wellenkern BURSTS EEG headset and checking electrode impedance.
After the setup, you can start recording EEG data by clicking the "Start Recording" button. To end the recording, simply click the "Stop Recording" button.

### 3. Access the Recorded Data
After you have successfully recorded your EEG data, you can access the recorded files in the `backend/recordings/` directory, either on your local machine or on the server where the backend is hosted.

<br />

<!-- Deployment -->
## :cloud: Deployment

> **Note:**  
> To use systemctl for managing the backend (websocket) and Flask server (flask_server), you need to create appropriate systemd service files for each.
For serving the frontend, configure Apache to serve the files from the `frontend/dist/` directory.
Refer to the official documentation for Apache and systemd if you need setup details.

You can deploy this project using any web server that supports Node.js and Flask. Here are the general steps:
1. **Set up a web server**: On your server, ensure that you have Apache, Node.js and Flask installed.
2. **Clone the repository**: Clone this repository as described in the "Getting Started" section.
3. **Install dependencies**: Follow the instructions in the "Installation" section to install the necessary dependencies for the frontend, backend and flask server.
4. **Configure the backend URL**: Adjust the backend server URL in the frontend module as described in the "Adjust the Backend Server URL in the Frontend Module" section. The Frontend should now point to your server's backend URL.
5. **Create and enable systemd service files**:  
   Create systemd service files for the backend (`websocket`) and Flask server (`flask_server`) in `/etc/systemd/system/`.

   Please refer to the official documentation for systemd if you need help creating service files.
6. **Start the services**:  
   After creating the service files, reload systemd and enable the services to start on boot
    ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable websocket
   sudo systemctl start websocket
   sudo systemctl enable flask_server
   sudo systemctl start flask_server
   ```
   

### Update your Server
On the server, pull the current main branch of this repository into your local copy. Then, rebuild the frontend and restart the all services using the following commands:
   - For the frontend:
     ```bash
     cd frontend
     npm install
     npm run build
     systemctl restart apache2
     ```
   - For the backend and flask server:
     ```bash
     systemctl restart websocket
     systemctl restart flask_server
     ```

<br />

<!-- Contributing -->
## :busts_in_silhouette: Contributing

Contributions are always welcome! Please get in touch with us via email or open an issue or pull request on GitHub.

### Contributors

<a href="https://github.com/Louis3797/awesome-readme-template/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=OS-EEG-COLLECT/eeg-collect" />
</a>

<br />

<!-- License -->
## :scroll: License

Distributed under the AGPL-3.0 License. See [LICENSE.txt](https://github.com/OS-EEG-COLLECT/eeg-collect/blob/master/LICENSE) for more information.

<br />

<!-- Contact -->
## :speech_balloon: Contact

Dr. Michael Knierim - [KIT-Webpage](https://im.win.kit.edu/team_1261.php) - michael.knierim@kit.edu
