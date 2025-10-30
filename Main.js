const videoElement = document.getElementById('webcamVideo');
const canvasElement = document.getElementById('outputCanvas');
const canvasCtx = canvasElement.getContext('2d');
const statusDiv = document.getElementById('status');
const eyeInfoDiv = document.getElementById('eyeInfo');
const timerDisplay = document.getElementById('timer');

//variables for checking focus
var isFocused = true; 
var startTime;
var AWAYTHRESHOLD = 10000;
var accumulatedAway = 0;

//sees if audio is still playing, avoids playing audio if another one is still in progress
var audioPlaying = false;

//Pomodoro timer variables
var accumulatedFocus = 0;
var FOCUSTHRESHOLD = 40000;
var ENCOURAGTHRESHOLD = 15000;
var accumulatedEncourage = 0;
var onBreak = false;

//Focus Audios
const focusAudio = [
  'Audios/Focused/Thats_a_solid_run.mp3',
  'Audios/Focused/Youre_lowkey_killing it.mp3',
  'Audios/Focused/Youve_been_in_the_zone.mp3'
]

//rest Audios
const restAudio = [
  'Audios/Focused/Just_a_reminder_to_rest_up_a_bit.mp3',
  'Audios/Focused/Make_sure_to_rest.mp3',
  'Audios/Focused/Remember_to_take_a_break.mp3',
]

//Unfocused audios
const awayAudio = [
  'Audios/Losing Focus/Alright_lets_lock_in_again.mp3',
  'Audios/Losing Focus/Caught_ya_drifting.mp3',
  'Audios/Losing Focus/Looks_like_your_focus_slid_a_bit.mp3',
  'Audios/Losing Focus/Your_brain_went_on_a_lil_detour.mp3'
]

//start up Audios
const startUpAudio = [
  'Audios/Start up/Hey_Im_LockIn.mp3',
  'Audios/Start up/Im_here_to_help.mp3',
  'Audios/Start up/Think_of_me_like_a_vibe_check.mp3'
]

//Ending session audios
const endAudio = [
  'duck life.mp3',
  'warning1.mp3',
  'warning2.mp3',
  'alert.mp3',
  'attention.mp3'
]

// Eye landmark indices from MediaPipe Face Mesh
const LEFT_EYE_INDICES = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const RIGHT_EYE_INDICES = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
const LEFT_IRIS_INDICES = [468, 469, 470, 471, 472];
const RIGHT_IRIS_INDICES = [473, 474, 475, 476, 477];

// Initialize MediaPipe Face Mesh
const faceMesh = new FaceMesh({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
  }
});

faceMesh.setOptions({
  maxNumFaces: 1,
  refineLandmarks: true, // Important for iris tracking
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

faceMesh.onResults(onResults);

function onResults(results) {
  //Timer stuff
  const remaining = Math.max(0, FOCUSTHRESHOLD - accumulatedFocus);
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  // Set canvas size to match video
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;

  // Clear canvas
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
    const landmarks = results.multiFaceLandmarks[0];
    
    // Draw left eye
    drawEye(landmarks, LEFT_EYE_INDICES, '#4CAF50');
    // Draw right eye
    drawEye(landmarks, RIGHT_EYE_INDICES, '#2196F3');
    
    // Draw iris points
    drawIris(landmarks, LEFT_IRIS_INDICES, '#FF5722');
    drawIris(landmarks, RIGHT_IRIS_INDICES, '#FF5722');

    // Calculate and display eye information
    updateEyeInfo(landmarks);
  } else {
    checkFocus(null);
    eyeInfoDiv.innerHTML = 'No face detected';
  }

  canvasCtx.restore();
}

function drawEye(landmarks, indices, color) {
  canvasCtx.strokeStyle = color;
  canvasCtx.lineWidth = 2;
  canvasCtx.beginPath();
  
  indices.forEach((idx, i) => {
    const point = landmarks[idx];
    const x = point.x * canvasElement.width;
    const y = point.y * canvasElement.height;
    
    if (i === 0) {
      canvasCtx.moveTo(x, y);
    } else {
      canvasCtx.lineTo(x, y);
    }
  });
  
  canvasCtx.closePath();
  canvasCtx.stroke();
}

function drawIris(landmarks, indices, color) {
  canvasCtx.fillStyle = color;
  
  indices.forEach(idx => {
    const point = landmarks[idx];
    const x = point.x * canvasElement.width;
    const y = point.y * canvasElement.height;
    
    canvasCtx.beginPath();
    canvasCtx.arc(x, y, 3, 0, 2 * Math.PI);
    canvasCtx.fill();
  });
}

function updateEyeInfo(landmarks) {
  checkFocus(landmarks);
  // Get iris centers (center point of each iris)
  const leftIrisCenter = landmarks[468];
  const rightIrisCenter = landmarks[473];
  
  // Calculate eye openness (vertical distance)
  const leftEyeTop = landmarks[159];
  const leftEyeBottom = landmarks[145];
  const leftEyeOpenness = Math.abs(leftEyeTop.y - leftEyeBottom.y);
  
  const rightEyeTop = landmarks[386];
  const rightEyeBottom = landmarks[374];
  const rightEyeOpenness = Math.abs(rightEyeTop.y - rightEyeBottom.y);

  eyeInfoDiv.innerHTML = `
    <strong>Left Eye:</strong><br>
    Iris Center: (${(leftIrisCenter.x * 100).toFixed(1)}%, ${(leftIrisCenter.y * 100).toFixed(1)}%)<br>
    Openness: ${(leftEyeOpenness * 100).toFixed(2)}%<br><br>
    
    <strong>Right Eye:</strong><br>
    Iris Center: (${(rightIrisCenter.x * 100).toFixed(1)}%, ${(rightIrisCenter.y * 100).toFixed(1)}%)<br>
    Openness: ${(rightEyeOpenness * 100).toFixed(2)}%<br><br>
    
    <small>Green = Left Eye, Blue = Right Eye, Red = Iris</small>
  `;
}

//Checks to see how focused the user is
function checkFocus(landmarks){
  if(audioPlaying) return;
  console.log("away is at"+accumulatedAway+" out of "+AWAYTHRESHOLD);
  console.log("focus is at "+accumulatedFocus+" out of "+FOCUSTHRESHOLD);
  console.log("encourage is at"+accumulatedEncourage+" out of "+ENCOURAGTHRESHOLD);
  //returns either NOTFOCUSED or FOCUSED based on user actions
  const focus = payingAttention(landmarks);

  //accumulate how long user stays UNFOCUSED
  if(focus === "NOTFOCUSED") {
    if(isFocused){
      isFocused = false;
      startTime = Date.now();
      return;
    }
    accumulatedAway += (Date.now()-startTime);
    startTime = Date.now();
  }
  else{
    //If user has been focused, accumulate focus time
    if(isFocused){
      accumulatedFocus += Date.now()-startTime;
      accumulatedEncourage += Date.now()-startTime;
      startTime = Date.now();
      return;
    }
    isFocused = true;
  }

  //If accumalatedEncourage hits threshold play associated audio
  if(accumulatedEncourage >= ENCOURAGTHRESHOLD){
    goodWork();
    return;
  }

  //If Focus hits threshold, play associated audio
  if(accumulatedFocus >= FOCUSTHRESHOLD){
    takeBreak();
    return;
  }

  //If focus stays unfocused until threshold play associated audio
  if(accumulatedAway >= AWAYTHRESHOLD){
    lockIn();
    return;
  }

  //see what window they're using
}

//Helper function to determine if person is looking at center screen
function payingAttention(landmarks){
  if(landmarks === null) {
    console.log("no face detected");
    return "NOTFOCUSED";
  }
  const headLook = getHeadPose(landmarks);
  const gazeDir = detectGaze(landmarks);

  console.log("Gaze is facing ",gazeDir,"Direction");
  console.log("Head is facing ",headLook,"Direction");

  if(
  (headLook === "LEFT" && gazeDir.horizontal !== "RIGHT") ||
  (headLook === "RIGHT" && gazeDir.horizontal !== "LEFT") ||
  (gazeDir.vertical != "CENTER")
  ){
    return "NOTFOCUSED";
  }
  return "FOCUSED";
}

//If losing focus queue a message
async function lockIn(){
  const randomIndex = Math.floor(Math.random() * awayAudio.length);
  const audio = awayAudio[randomIndex];
  console.log(audio);
  await playAudio(audio);
  accumulatedAway = 0;
  isFocused = true;
}

//if focused tell user good job
async function goodWork(){
  const randomIndex = Math.floor(Math.random() * focusAudio.length);
  const audio = focusAudio[randomIndex];
  console.log(audio);
  await playAudio(audio);
  accumulatedEncourage = 0;
  ENCOURAGTHRESHOLD = Math.random() * ((FOCUSTHRESHOLD/2)-(FOCUSTHRESHOLD/3))+(FOCUSTHRESHOLD/3);
  isFocused = false;
}

//If user has been focused for a while, tell them to take a break
async function takeBreak(){
  const randomIndex = Math.floor(Math.random() * restAudio.length);
  const audio = restAudio[randomIndex];
  console.log(audio);
  await playAudio(audio);
  accumulatedFocus = 0;
  isFocused = false;
}


//Sees if eyes are looking center, left, or right or up or down.
function detectGaze(landmarks){
  const LEFT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
  
  // Get center of eye shape
  const eyeCenter = getEyeCenter(landmarks, LEFT_EYE);
  
  // Get iris center
  const irisCenter = landmarks[468];
  
  // Calculate offset from eye center
  const offsetX = irisCenter.x - eyeCenter.x;
  const offsetY = irisCenter.y - eyeCenter.y;
  
  // Thresholds (you may need to tune these)
  const thresholdX = 0.010;  // Adjust based on testing
  const thresholdY = 0.003;
  
  let horizontal = "CENTER";
  let vertical = "CENTER";
  
  if (offsetX < -thresholdX) horizontal = "LEFT";
  if (offsetX > thresholdX) horizontal = "RIGHT";
  if (offsetY < -thresholdY) vertical = "UP";
  if (offsetY > thresholdY) vertical = "DOWN";
  
  return { horizontal, vertical};
}

//Gets the center of an eye
function getEyeCenter(landmarks, eyeIndices) {
  let sumX = 0, sumY = 0;
  eyeIndices.forEach(idx => {
    sumX += landmarks[idx].x;
    sumY += landmarks[idx].y;
  });
  return {
    x: sumX / eyeIndices.length,
    y: sumY / eyeIndices.length
  };
}

//Sees what direction the head is point in
function getHeadPose(landmarks) {
  // Key reference points for head orientation
  const noseTip = landmarks[1];        // Front of nose
  const chinBottom = landmarks[152];   // Bottom of chin
  const leftEar = landmarks[234];      // Left side of face
  const rightEar = landmarks[454];     // Right side of face
  const forehead = landmarks[10];      // Top of face
  
  // Horizontal rotation (yaw) - looking left/right
  const faceWidth = rightEar.x - leftEar.x;
  const noseToCenterX = noseTip.x - (leftEar.x + rightEar.x) / 2;
  const yaw = noseToCenterX / faceWidth;
  
  // Vertical rotation (pitch) - looking up/down
  const faceHeight = chinBottom.y - forehead.y;
  const noseToCenterY = noseTip.y - (forehead.y + chinBottom.y) / 2;
  const pitch = noseToCenterY / faceHeight;
  
  // Use Z-depth for better accuracy
  const leftRightDepthDiff = leftEar.z - rightEar.z;
  
  let headDirection = "CENTER";
  
  // Thresholds for head turn
  if (yaw < -0.15 || leftRightDepthDiff > 0.05) headDirection = "LEFT";
  if (yaw > 0.15 || leftRightDepthDiff < -0.05) headDirection = "RIGHT";
  if (pitch < -0.15) headDirection += " UP";
  if (pitch > 0.15) headDirection += " DOWN";
  
  return headDirection;
}

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await faceMesh.send({image: videoElement});
  },
  width: 640,
  height: 480
});

// Start camera when button is clicked
const startButton = document.getElementById('startButton');
startButton.addEventListener('click', function() {
  startIntro();
  startCamera();
});

//Plays through all the audios associated with start up
async function startIntro(){
  for (const audioName of startUpAudio) {
    await playAudio(audioName);
  }
  accumulatedEncourage = 0;
  accumulatedFocus = 0;
  startTime = Date.now();
}

//When given an audio, plays it (async friendly)
function playAudio(audioName){
  return new Promise((resolve) =>{
    audioPlaying = true;
    var audio = new Audio(audioName);
    audio.addEventListener('ended', function() {
    console.log('Audio finished playing!');
    audioPlaying = false;
    resolve();
  });
  audio.play();
  });
}

function startCamera(){
  statusDiv.className = 'status loading';
  statusDiv.textContent = 'Starting camera...';
  startButton.disabled = true;
  startButton.style.opacity = '0.5';
  
  camera.start().then(() => {
    statusDiv.className = 'status ready';
    statusDiv.textContent = 'Camera active - Eye detection running';
    startButton.style.display = 'none';
  }).catch((error) => {
    statusDiv.className = 'status error';
    statusDiv.textContent = 'Error: ' + error.message;
    startButton.disabled = false;
    startButton.style.opacity = '1';
    console.error(error);
  });
}