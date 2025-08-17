<div align="center">

  <img src="assets/logo.png" alt="logo" width="200" height="auto" />
  <h1>Wellenkern STREAMS</h1>
  
  <p>
    A web-based platform for bio-signal data collection using Wellenkern wearables BURSTS (EEG) and BEAMS (fNIRS, coming later). 
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

Weelenkern STREAMS provides a customizable, user-friendly platform for EEG data collection using OpenBCI hardware.
It streamlines the setup process and supports versatile electrode configurations, making EEG-based BCI research more accessible.
The Vue 3 and D3.js frontend offers real-time impedance checks helping the user establish a stable connection with Wellenkern BURSTS,
while the backend — built with Apache, Node.js, and Flask — handles efficient data transmission and storage.
Designed for cross-platform compatibility and efficient session management,
the platform is well-suited for large-scale and field studies, offering automated data management and real-time feedback to enhance data quality and reliability.

<!-- Features -->
### Features

- Feature 1
- Feature 2
- Feature 3

<!-- Color Reference -->
### Color Reference

| Color             | Hex                                                                |
| ----------------- | ------------------------------------------------------------------ |
| Primary Color | ![#222831](https://via.placeholder.com/10/222831?text=+) #222831 |
| Secondary Color | ![#393E46](https://via.placeholder.com/10/393E46?text=+) #393E46 |
| Accent Color | ![#00ADB5](https://via.placeholder.com/10/00ADB5?text=+) #00ADB5 |
| Text Color | ![#EEEEEE](https://via.placeholder.com/10/EEEEEE?text=+) #EEEEEE |



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

1. To instll the frontend dependencies, navigate to the `frontend/` directory and run:
  ```bash
    npm install
  ```

2. Next, install the backend dependencies by navigating to the `backend/` directory and running the same command:
  ```bash
    npm install
  ```
3. Finally, install the Flask server dependencies by navigating to the `impedance/` directory and running:
  ```bash
    pip install -r requirements.txt
  ```

<!-- Adjust the Backend Server URL in the Frontend Module -->
### 3. Adjust the Backend Server URL in the Frontend Module

During data recording, the frontend service continuously streams signal data to the backend server.
To ensure that the frontend can communicate with the backend, you need to adjust the backend server URL in the frontend module.
<br /> To do so, open the `frontend/src/utils/helpers.ts` file, and set the `WEB_SOCKET_URL` property of the `URLs` object to your server.
E.g.:
```typescript
  export const URLs = { WEB_SOCKET_URL: "wss://exg.iism.kit.edu/websocket/" };
```

For development purposes, you can use the following URL.
```typescript
  export const URLs = { WEB_SOCKET_URL: "ws://localhost:3000/websocket/" };
```

The default port is `3000`, but you can change it to your desired port.
Remember to ensure that you start the backend server on the specified port.

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

<br />

<!-- Deployment -->
## :cloud: Deployment

To deploy this project run

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
