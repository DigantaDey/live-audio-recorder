(() => {
    let mediaRecorder, audioChunks = [], audioURL, audioContext, source, gainNode, destination, playbackStream, playbackAudio, startTime, timerInterval;

    const recordButton = document.getElementById('record');
    const pauseButton = document.getElementById('pause');
    const resumeButton = document.getElementById('resume');
    const stopButton = document.getElementById('stop');
    const playButton = document.getElementById('play');
    const saveButton = document.getElementById('save');
    const volumeControl = document.getElementById('volume');
    const status = document.getElementById('status');
    const timer = document.getElementById('timer');
    const visualizer = document.getElementById('visualizer');
    const canvasContext = visualizer.getContext('2d');

    function updateStatus(message) {
        status.textContent = message;
    }

    function updateDuration() {
        const duration = Math.floor((Date.now() - startTime) / 1000);
        timer.textContent = `Recording Duration: ${duration}s`;
    }

    function resetButtons() {
        recordButton.disabled = false;
        pauseButton.disabled = true;
        resumeButton.disabled = true;
        stopButton.disabled = true;
        playButton.disabled = false;
        saveButton.disabled = false;
    }

    function setupAudioContext(stream) {
        audioContext = new AudioContext();
        source = audioContext.createMediaStreamSource(stream);
        gainNode = audioContext.createGain();
        gainNode.gain.value = volumeControl.value;
        destination = audioContext.createMediaStreamDestination();
        source.connect(gainNode).connect(destination);
        visualizeAudio();
    }
    function visualizeAudio() {
        const analyser = audioContext.createAnalyser();
        source.connect(analyser);
        analyser.fftSize = 2048;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        function draw() {
            requestAnimationFrame(draw);
            analyser.getByteTimeDomainData(dataArray);

            canvasContext.fillStyle = 'rgb(200, 200, 200)';
            canvasContext.fillRect(0, 0, visualizer.width, visualizer.height);

            canvasContext.lineWidth = 2;
            canvasContext.strokeStyle = 'rgb(0, 0, 0)';
            canvasContext.beginPath();

            const sliceWidth = visualizer.width * 1.0 / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = v * visualizer.height / 2;

                if (i === 0) {
                    canvasContext.moveTo(x, y);
                } else {
                    canvasContext.lineTo(x, y);
                }

                x += sliceWidth;
            }

            canvasContext.lineTo(visualizer.width, visualizer.height / 2);
            canvasContext.stroke();
        }

        draw();
    }
    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 44100,
                    channelCount: 2,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            setupAudioContext(stream);

            playbackStream = new Audio();
            playbackStream.srcObject = destination.stream;
            playbackStream.play();

            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
            mediaRecorder.start();

            startTime = Date.now();
            timerInterval = setInterval(updateDuration, 1000);

            recordButton.disabled = true;
            pauseButton.disabled = false;
            stopButton.disabled = false;
            updateStatus('Recording...');
        } catch (error) {
            updateStatus(`Error: ${error.message}`);
        }
    }

    function pauseRecording() {
        if (mediaRecorder.state === 'recording') {
            mediaRecorder.pause();
            playbackStream.pause();
            clearInterval(timerInterval);
            pauseButton.disabled = true;
            resumeButton.disabled = false;
            updateStatus('Recording Paused');
        }
    }

    function resumeRecording() {
        if (mediaRecorder.state === 'paused') {
            mediaRecorder.resume();
            playbackStream.play();
            startTime = Date.now();
            timerInterval = setInterval(updateDuration, 1000);
            pauseButton.disabled = false;
            resumeButton.disabled = true;
            updateStatus('Recording...');
        }
    }

    function stopRecording() {
        mediaRecorder.stop();
        mediaRecorder.onstop = () => {
            clearInterval(timerInterval);
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            audioURL = URL.createObjectURL(audioBlob);
            document.getElementById('audioPlayback').src = audioURL;
            audioChunks = [];

            resetButtons();
            updateStatus('Recording Stopped');
        };

        playbackStream.pause();
        playbackStream.srcObject = null;
        source.disconnect(gainNode);
        gainNode.disconnect(destination);
        audioContext.close();
    }

    function playAudio() {
        if (playButton.textContent === 'Play') {
            if (playbackAudio) {
                playbackAudio.pause();
                playbackAudio.currentTime = 0;
            }

            playbackAudio = new Audio(audioURL);
            playbackAudio.play();
            playButton.textContent = 'Pause Playing';
            playButton.classList.replace('bg-purple-500', 'bg-orange-500');
            playButton.classList.replace('hover:bg-purple-600', 'hover:bg-orange-600');

            playbackAudio.onended = () => {
                playButton.textContent = 'Play';
                playButton.classList.replace('bg-orange-500', 'bg-purple-500');
                playButton.classList.replace('hover:bg-orange-600', 'hover:bg-purple-600');
                updateStatus('Playback Ended');
            };
            updateStatus('Playing...');
        } else {
            playbackAudio.pause();
            playButton.textContent = 'Play';
            playButton.classList.replace('bg-orange-500', 'bg-purple-500');
            playButton.classList.replace('hover:bg-orange-600', 'hover:bg-purple-600');
            updateStatus('Playback Paused');
        }
    }

    function saveAudio() {
        const a = document.createElement('a');
        const dateTime = new Date().toISOString().replace(/[:.-]/g, '_').replace('T', '_').split('.')[0];
        a.style.display = 'none';
        a.href = audioURL;
        a.download = `${dateTime}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        updateStatus('Recording Saved');
    }

    recordButton.addEventListener('click', startRecording);
    pauseButton.addEventListener('click', pauseRecording);
    resumeButton.addEventListener('click', resumeRecording);
    stopButton.addEventListener('click', stopRecording);
    playButton.addEventListener('click', playAudio);
    saveButton.addEventListener('click', saveAudio);
    volumeControl.addEventListener('input', () => {
        if (gainNode) gainNode.gain.value = volumeControl.value;
    });
})();