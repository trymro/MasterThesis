function GameManager(){
    var numberOfBlocks = 0;
    var gridCanvas = document.getElementById('grid-canvas');
    var nextCanvas = document.getElementById('next-canvas');
    var scoreContainer = document.getElementById("score-container");
    var unlinesContainer = document.getElementById("unlines-container")
    var resetButton = document.getElementById('reset-button');
    var gridContext = gridCanvas.getContext('2d');
    var nextContext = nextCanvas.getContext('2d');
    var timerElement = document.getElementById('timer-container');
    var startButton = document.getElementById('startButton');
    var turnsSinceVirusCheck = 1;
    var securityLevel = 0;
    var turnsTilStopClear = 0;
    var logFileNumber = 1;
    var logStarted = false;
    var gameNumber = 0;
    let timeRemaining = 4 * 60;
    let interval;
    let activeButton = null;
    let timer;
    let savedPlayerName;
    let timerPaused = true;
    let pauseTime = 0;
    const saveButton = document.getElementById('saveButton');
    const timeSinceStart = createCentisecondTimer(); //used for making timestamps for the log
    const logEntries = [];
    saveButton.addEventListener('click', handleClick);

    document.addEventListener('keydown', onKeyDown);

    var grid = new Grid(22, 13);
    var rpg = new RandomPieceGenerator();
    var ai = new AI({
        heightWeight: 0.510066,
        linesWeight: 0.760666,
        holesWeight: 0.35663,
        bumpinessWeight: 0.184483
    });
    var workingPieces = [null, rpg.nextPiece()];
    var workingPiece = null;
    var isAiActive = true;
    var isKeyEnabled = false;
    var gravityTimer = new Timer(onGravityTimerTick, 400);
    var score = 0;
    var unclearedLines = 0;


    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Graphics
    function intToRGBHexString(v){
        return 'rgb(' + ((v >> 16) & 0xFF) + ',' + ((v >> 8) & 0xFF) + ',' + (v & 0xFF) + ')';
    }

    function redrawGridCanvas(workingPieceVerticalOffset = 0){
        gridContext.save();

        // Clear
        gridContext.clearRect(0, 0, gridCanvas.width, gridCanvas.height);

        // Draw grid
        for(var r = 2; r < grid.rows; r++){
            for(var c = 0; c < grid.columns; c++){
                if (grid.cells[r][c] != 0){
                    gridContext.fillStyle= intToRGBHexString(grid.cells[r][c]);
                    gridContext.fillRect(20 * c, 20 * (r - 2), 20, 20);
                    gridContext.strokeStyle="#FFFFFF";
                    gridContext.strokeRect(20 * c, 20 * (r - 2), 20, 20);
                }
            }
        }

        // Draw working piece
        for(var r = 0; r < workingPiece.dimension; r++){
            for(var c = 0; c < workingPiece.dimension; c++){
                if (workingPiece.cells[r][c] != 0){
                    gridContext.fillStyle = intToRGBHexString(workingPiece.cells[r][c]);
                    gridContext.fillRect(20 * (c + workingPiece.column), 20 * ((r + workingPiece.row) - 2) + workingPieceVerticalOffset, 20, 20);
                    gridContext.strokeStyle="#FFFFFF";
                    gridContext.strokeRect(20 * (c + workingPiece.column), 20 * ((r + workingPiece.row) - 2) + workingPieceVerticalOffset, 20, 20);
                }
            }
        }

        gridContext.restore();
    }

    function redrawNextCanvas(){
        nextContext.save();

        nextContext.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
        var next = workingPieces[1];
        var xOffset = next.dimension == 2 ? 20 : next.dimension == 3 ? 10 : next.dimension == 4 ? 0 : null;
        var yOffset = next.dimension == 2 ? 20 : next.dimension == 3 ? 20 : next.dimension == 4 ? 10 : null;
        for(var r = 0; r < next.dimension; r++){
            for(var c = 0; c < next.dimension; c++){
                if (next.cells[r][c] != 0){
                    nextContext.fillStyle = intToRGBHexString(next.cells[r][c]);
                    nextContext.fillRect(xOffset + 20 * c, yOffset + 20 * r, 20, 20);
                    nextContext.strokeStyle = "#FFFFFF";
                    nextContext.strokeRect(xOffset + 20 * c, yOffset + 20 * r, 20, 20);
                }
            }
        }

        nextContext.restore();
    }

    //updates scoreContainer
    function updateScoreContainer(){
        scoreContainer.innerHTML = score.toString();
    }

    //updates the uncleared lines
    function updateUnLinesContainer(){
        unlinesContainer.innerHTML = unclearedLines.toString();
    }

    // Drop animation
    var workingPieceDropAnimationStopwatch = null;

    function startWorkingPieceDropAnimation(callback = function(){}){
        // Calculate animation height
        animationHeight = 0;
        _workingPiece = workingPiece.clone();
        while(_workingPiece.moveDown(grid)){
            animationHeight++;
        }

        var stopwatch = new Stopwatch(function(elapsed){
            if(elapsed >= animationHeight * 60){
                stopwatch.stop();
                redrawGridCanvas(60 * animationHeight);
                callback();
                return;
            }

            redrawGridCanvas(20 * elapsed / 60);
        });

        workingPieceDropAnimationStopwatch = stopwatch;
    }

    function cancelWorkingPieceDropAnimation(){
        if(workingPieceDropAnimationStopwatch === null){
            return;
        }
        workingPieceDropAnimationStopwatch.stop();
        workingPieceDropAnimationStopwatch = null;
    }

    // Process start of turn
    function startTurn(){
        //updates the uncleared lines at the end of the turn, unless the reset button is disabled, then it waits until its no longer collecting
        if(!resetButton.disabled) {
            unclearedLines = grid.countFilledLines();
            updateUnLinesContainer();
        }

        //every time a brick spwnes it will check if there is a virus or a possiblity for a false positive, This block will execute approximately 1 out of every 5.9 times (with a total of 354 blocks landing over 5 minutes autoplaying and waiting for the game to clear all rows without any virus attacks and ) that gives around 6 virus attacks per game
        if (turnsSinceVirusCheck == 6) {
            randomVirus();
            turnsSinceVirusCheck = 1;
        } else {
            turnsSinceVirusCheck += 1;
        }
        
        // Shift working pieces
        for(var i = 0; i < workingPieces.length - 1; i++){
            workingPieces[i] = workingPieces[i + 1];
        }
        workingPieces[workingPieces.length - 1] = rpg.nextPiece();
        workingPiece = workingPieces[0];

        // Refresh Graphics
        redrawGridCanvas();
        redrawNextCanvas();

        if(isAiActive){
            isKeyEnabled = false;
            workingPiece = ai.best(grid, workingPieces);
            startWorkingPieceDropAnimation(function(){
                while(workingPiece.moveDown(grid)); // Drop working piece
                if(!endTurn()){
                    clearOnFull();
                }
                //checks if points have been collected and will clear the next 6 bricks
                if(turnsTilStopClear>0){
                    turnsTilStopClear -= 1;
                    resetButton.textContent = `Collection Finished in: ${turnsTilStopClear}`;
                    grid = new Grid(22, 13);
                    turnsSinceVirusCheck = 1; //resetting the number of turns since virus check
                    if(turnsTilStopClear==0) {
                        updateScoreContainer();
                        resetButton.textContent = 'Click to Collect Lines';
                        resetButton.disabled = false;
                    }
                }
                
                startTurn();
            })
        }else{
            isKeyEnabled = true;
            gravityTimer.resetForward(500);
        }
    }

    // Process end of turn
    function endTurn(){
        // Add working piece
        grid.addPiece(workingPiece);

        // Clear lines
        //score += grid.clearLines();

        // Refresh graphics
        redrawGridCanvas();
        //updateScoreContainer();

        return !grid.exceeded();
    }

    // Process gravity tick
    function onGravityTimerTick(){
        // If working piece has not reached bottom
        if(workingPiece.canMoveDown(grid)){
            workingPiece.moveDown(grid);
            redrawGridCanvas();
            return;
        }

        // Stop gravity if working piece has reached bottom
        gravityTimer.stop();

        // If working piece has reached bottom, end of turn has been processed
        // and game cannot continue because grid has been exceeded
        if(!endTurn()){
            isKeyEnabled = false;
            clearOnFull();
        }

        // If working piece has reached bottom, end of turn has been processed
        // and game can still continue.
        startTurn();
    }

    // Process keys
    function onKeyDown(event){
        if(!isKeyEnabled){
            return;
        }
        switch(event.which){
            case 32: // spacebar
                isKeyEnabled = false;
                gravityTimer.stop(); // Stop gravity
                startWorkingPieceDropAnimation(function(){ // Start drop animation
                    while(workingPiece.moveDown(grid)); // Drop working piece
                    if(!endTurn()){
                        clearOnFull();
                        }
                    startTurn();
                });
                break;
            case 40: // down
                gravityTimer.resetForward(500);
                break;
            case 37: //left
                if(workingPiece.canMoveLeft(grid)){
                    workingPiece.moveLeft(grid);
                    redrawGridCanvas();
                }
                break;
            case 39: //right
                if(workingPiece.canMoveRight(grid)){
                    workingPiece.moveRight(grid);
                    redrawGridCanvas();
                }
                break;
            case 38: //up
                workingPiece.rotate(grid);
                redrawGridCanvas();
                break;
        }
    }


    //converted into collect points button
    resetButton.onclick = function(){
        //button is disabled unless game is running
        if(timeRemaining==0 || timeRemaining== 300){
            return;
        }
        logAction(`Manual collection at secuirty level: ${securityLevel}`);
        setCollectionCount();
        score += grid.clearLines();
        gravityTimer.stop();
        cancelWorkingPieceDropAnimation();
        grid = new Grid(22, 13);
        rpg = new RandomPieceGenerator();
        workingPieces = [null, rpg.nextPiece()];
        workingPiece = null;
        isKeyEnabled = true;
        //updateScoreContainer();
        if(timeRemaining<0) {
            timeRemaining=0;
        }
        startTurn();
    }

    function collectPoints(){
        setCollectionCount();
        score += grid.clearLines();
        gravityTimer.stop();
        cancelWorkingPieceDropAnimation();
        grid = new Grid(22, 13);
        rpg = new RandomPieceGenerator();
        workingPieces = [null, rpg.nextPiece()];
        workingPiece = null;
        isKeyEnabled = true;
        //updateScoreContainer();        
        if(timeRemaining<0) {
            timeRemaining=0;
        }
    }


    function updateTimer() {
        //this code is not optimal at all, but with a syncronus updates of the time the timer will be set to -1 which was anoying, this is a 
        //quick fix.
        if(timeRemaining<=0) {
            timerElement.textContent = "00:00.0";
            return;
        }
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = Math.floor(timeRemaining % 60);
        const tenth = (timeRemaining - Math.floor(timeRemaining)).toFixed(1);
        timerElement.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenth.split('.')[1]}`;
    }


    //can be called at the start of every new block spwned to randomly delete 
    function randomVirus() {
        var virusAttack = Math.random() < 0.10; // 10% chance to start virus
        var shouldWarnUser = Math.random(); // rolls a dice that will be checked against the securityLevel
        console.log(virusAttack);
        console.log(shouldWarnUser);
        numberOfBlocks += 1;
        if(virusAttack){
            logAction("Virus attack");
        }
        switch (securityLevel) {
            case 1:
                if (virusAttack) {                    
                    if (shouldWarnUser < 0.31) {
                        pauseTimer();
                        setTimeout(() => {
                        warnUser();
                        }, 10);                        
                    }else{grid.clearRandomPoints();logAction("Virus deletion finished");}//if the user isn't warned, the points in the grid will be removed'
                } else {                    
                    if (shouldWarnUser < 0.01) {
                        pauseTimer();
                        setTimeout(() => {
                        warnUserFalse();
                        }, 10);
                    }
                }
                break;
            case 2:
                if (virusAttack) {
                    if (shouldWarnUser < 0.50) {
                        pauseTimer();
                        setTimeout(() => {
                        warnUser();
                        }, 10);
                    }else{grid.clearRandomPoints();logAction("Virus deletion finished");}
                } else {
                    if (shouldWarnUser < 0.02) {
                        pauseTimer();
                        setTimeout(() => {
                        warnUserFalse();
                        }, 10);
                    }
                }
                break;
            case 3:
                if (virusAttack) {
                    if (shouldWarnUser < 0.69) {
                        pauseTimer();
                        setTimeout(() => {
                        warnUser();
                        }, 10);
                    }else{grid.clearRandomPoints();logAction("Virus deletion finished");}
                } else {
                    if (shouldWarnUser < 0.07) {
                        pauseTimer();
                        setTimeout(() => {
                        warnUserFalse();
                        }, 10);
                    }
                }
                break;
            case 4:
                if (virusAttack) {
                    if (shouldWarnUser < 0.84) {
                        pauseTimer();
                        setTimeout(() => {
                        warnUser();
                        }, 10);
                    }else{grid.clearRandomPoints();logAction("Virus deletion finished");}
                } else {
                    if (shouldWarnUser < 0.15) {
                        pauseTimer();
                        setTimeout(() => {
                        warnUserFalse();
                        }, 10);
                    }
                }
                break;
            case 5:
                if (virusAttack) {
                    if (shouldWarnUser < 0.93) {
                        pauseTimer();
                        setTimeout(() => {
                        warnUser();
                        }, 10);
                    }else{grid.clearRandomPoints();logAction("Virus deletion finished");}
                } else {
                    if (shouldWarnUser < 0.31) {
                        pauseTimer();
                        setTimeout(() => {
                        warnUserFalse();
                        }, 10);
                    }
                }
                break;
            case 6:
                if (virusAttack) {
                    if (shouldWarnUser < 0.98) {
                        pauseTimer();
                        setTimeout(() => {
                        warnUser();
                        }, 10);
                    }else{grid.clearRandomPoints();logAction("Virus deletion finished");}
                } else {
                    if (shouldWarnUser < 0.50) {
                        pauseTimer();
                        setTimeout(() => {
                        warnUserFalse();
                        }, 10);
                    }
                }
                break;
            case 7:
                if (virusAttack) {
                    if (shouldWarnUser < 0.99) {
                        pauseTimer();
                        setTimeout(() => {
                        warnUser();
                        }, 10);
                    }else{grid.clearRandomPoints();logAction("Virus deletion finished");}
                } else {
                    if (shouldWarnUser < 0.69) {
                        pauseTimer();
                        setTimeout(() => {
                        warnUserFalse();
                        }, 10);
                    }
                }
                break;
            default:
                console.log("Invalid security level");
        }        
    }


    //function to be called after pressing clear most of the time unless the game is finished 
    function setCollectionCount() {
        turnsTilStopClear = 7;
        resetButton.textContent = 'Collection Finished in: 7';
        resetButton.disabled = true;
    }

    //funksjon for � starte og stoppe en timer
    function startAndPrintTimer() {
      if (timer === undefined) {
        timer = performance.now();
      } else {
        const currentTime = performance.now();
        const elapsedTime = currentTime - timer;
        logAction(`Time spent thinking: ${(elapsedTime / 1000).toFixed(2)} seconds`);
        timer = undefined;
      }
    }

    //will warn the user that a threat was detected, user will have to ether collect points or do nothing by clicking cancel
    function warnUser() {
        logAction("User warned about virus attack");
        //timeRemaining += 1; //NB NOTES ON THE CODING, there should have been implemented a custom confirm message, as the alert and confirm messages implemented interupt the async functions for operating the grid, this means that the grid has to be cleared when using the confirm option, as well as adding 1 second to the timer, as it's consumed by the alert function leading to a jump in time, the compensation
        //  for aproximatly 1 second lost on counter from animation of confirm() will therefore have to be corected for in the log as it will not change the play of the game, it was just changed to acomodate the los in playtime, and not have the timer jump every time alert and confirm is used. This has been 
        startAndPrintTimer();
        var userChoice = confirm("The firewall has detected an attack, if you wish to collect points to guard against possible damage click 'ok', otherwise press 'cancel'");
        if (userChoice) {
            // User clicked OK
            logAction("RVA player collected lines");
            collectPoints();
            //starts a new turn
            gravityTimer.stop();
            cancelWorkingPieceDropAnimation();
            grid = new Grid(22, 10);
            rpg = new RandomPieceGenerator();
            workingPieces = [null, rpg.nextPiece()];
            workingPiece = null;
            startTurn();
        } else {
            // User clicked Cancel
            logAction("RVA player didnt collect lines");
            grid.clearRandomPoints();
            logAction("Virus deletion finished");
            gravityTimer.stop();
            cancelWorkingPieceDropAnimation();
            rpg = new RandomPieceGenerator();
            workingPieces = [null, rpg.nextPiece()];
            workingPiece = null;
            startTurn();
            }
        startAndPrintTimer();
        restartTimer();

    }
    //will warn the user that a threat was detected, but there are no threat, if they choose to do nothing nothing happens.
    function warnUserFalse() {
        logAction("User warned about a fake virus attack");
        //timeRemaining += 1;
        startAndPrintTimer();
        var userChoice = confirm("The firewall has detected an attack, if you wish to collect points to guard against possible damage click 'ok', otherwise press 'cancel'");
        if (userChoice) {
            // User clicked OK
            logAction("FVA player collected lines");
            collectPoints();
            //starts a new turn
            gravityTimer.stop();
            cancelWorkingPieceDropAnimation();
            grid = new Grid(22, 10);
            rpg = new RandomPieceGenerator();
            workingPieces = [null, rpg.nextPiece()];
            workingPiece = null;
            startTurn();
        } else{
            logAction("FVA player didnt collect lines"); 
            gravityTimer.stop();
            cancelWorkingPieceDropAnimation();
            rpg = new RandomPieceGenerator();
            workingPieces = [null, rpg.nextPiece()];
            workingPiece = null;
            startTurn();
          }
        startAndPrintTimer();    
        restartTimer();
    }

    //clears all the lines if the player doesn't clear before the grid is full to the top
    function clearOnFull(){
    logAction("Game filled up, lines were autocollected");
    setCollectionCount();
    score += grid.clearLines();
    //updateScoreContainer();
    grid = new Grid(22, 13);
    if(timeRemaining<0) {
        timeRemaining=0;
        }
    }

    //changes the color and security level
    function changeColor(button) {
    if (!button.classList.contains('security-level-btn')) {
        return; // Exit the function if the clicked button is not a security-level button
    }
    var tempsecurityLevel = button.id;
    if(timeRemaining != 300){    
        logAction(`Sec change. current: ${securityLevel} new: ${tempsecurityLevel}`);
    }
    securityLevel = parseInt(tempsecurityLevel, 10);
    if (activeButton !== null) {
        activeButton.style.backgroundColor = '#0ba31d';
    }

    button.style.backgroundColor = 'red';
    activeButton = button;
    }

    //adds a listener that will listen for a button being pressed
    document.addEventListener("DOMContentLoaded", () => {
        const securityButtons = document.querySelectorAll(".security-level-btn");

        securityButtons.forEach(button => {
            button.addEventListener("click", () => changeColor(button));
        });
    });
    

    //saves the player ID
    function savePlayerName(name) {
      // Convert the name to lowercase and check if it consists of only letters and numbers
      const lowercaseName = name.toLowerCase();
      const isValid = /^[a-z0-9]+$/.test(lowercaseName);

      if (isValid) {
        savedPlayerName = lowercaseName;
        saveButton.textContent = 'Saved!';
        // Select the label element by its id
        const playerIdField = document.getElementById('playerIdField');

        // Update the label's text content
        playerIdField.textContent = `Player ID: ${savedPlayerName}`;
        // Select the input field by its id
        const playerNameInput = document.getElementById('playerName');
        // Clear the input field
        playerNameInput.value = "";

        console.log(`Player name saved: ${savedPlayerName}`);
      } else {
        alert('Invalid player name. Name should only consist of lowercase letters and numbers.');
      }
    }

    function handleClick() {
      const playerName = document.getElementById('playerName').value;
      savePlayerName(playerName);
    }
    
    //displays textbox after game is complated
    function showGameOver() {
        document.getElementById('logFileNumber').textContent = logFileNumber;
        document.getElementById('gameOverText').style.display = 'flex';
    }
    //hides textbox
    function hideGameOver() {
        document.getElementById('gameOverText').style.display = 'none';
    }


    //counts down and stopes the game when counter is completed
    function countdown() {
        if (timeRemaining <= 0) {
            clearInterval(interval);
            timeRemaining = 0;
            updateTimer();
            score += grid.clearLines();
            updateScoreContainer();
            unclearedLines = 0;
            updateUnLinesContainer();
            gravityTimer.stop();
            cancelWorkingPieceDropAnimation();
            grid = new Grid(22, 13);
            redrawGridCanvas();
            redrawNextCanvas();
            rpg = new RandomPieceGenerator();
            workingPieces = [null, rpg.nextPiece()];
            workingPiece = null;
            isKeyEnabled = true;
            resetButton.textContent = 'Click to Collect Lines';
            resetButton.disabled = false;
            logAction("game finsihed");
            alert('Time is up! Click "OK" to collect your remaining points');
            showGameOver();
            downloadLogFile(); //downloads the logfile for this playthrough
            return;
        }
        if (timerPaused) return;
        const currentTime = performance.now();
        const elapsedTime = (currentTime - pauseTime) / 1000;
        pauseTime = currentTime;
        timeRemaining -= elapsedTime;
        updateTimer();
    }

    function pauseTimer() {
        if (!timerPaused) {
            timerPaused = true;
        }
    }

    function restartTimer() {
        if (timerPaused) {
            timerPaused = false;
            pauseTime = performance.now();
        }
    }


    //starts the game the first time and after the game has been stopped
    startButton.addEventListener('click', function() {
        hideGameOver();
        if(securityLevel == 0){
            alert("Please choose a security level before starting the game");
            return;
        }
        if(!savedPlayerName){
            alert("Please enter your player idea before starting the game");
            return;
        }
        if (!interval) {
            interval = setInterval(countdown, 100); //starting interval with 50milliseconds to make sure the pause function is updated quickly
            startTurn();
            score = 0;
            updateScoreContainer();
            turnsTilStopClear = 0;
            timeSinceStart.start();
            gameNumber += 1;
            logAction(`Starting game number: ${gameNumber} Secuirty level: ${securityLevel}`);
            pauseTime = performance.now();
            timerPaused = false;
        } else if(interval && timeRemaining == 0) {
            console.log("going to the second if in start button");
            timeRemaining = 8 * 60;
            updateTimer();
            interval = setInterval(countdown, 100);
            startTurn();
            score = 0;
            updateScoreContainer();
            turnsTilStopClear = 0;
            timeSinceStart.start();
            logAction(`Starting Secuirty: ${securityLevel}`);
            pauseTime = performance.now();
            timerPaused = false;
        }
    });


    function createCentisecondTimer() {
      let startTime = null;
      let elapsedTime = 0;
      let interval = null;

      function start() {
        if (startTime === null) {
          startTime = Date.now() - elapsedTime;
          interval = setInterval(() => {
            elapsedTime = Date.now() - startTime;
          }, 10);
        }
      }

      function stop() {
        if (interval !== null) {
          clearInterval(interval);
          interval = null;
        }
      }

      function reset() {
        elapsedTime = 0;
        startTime = null;
        stop();
      }

      function getElapsedTime() {
        const totalCentiseconds = Math.floor(elapsedTime / 10);
        const minutes = Math.floor(totalCentiseconds / 6000);
        const seconds = Math.floor((totalCentiseconds % 6000) / 100);
        const centiseconds = totalCentiseconds % 100;

        const formattedMinutes = String(minutes).padStart(2, '0');
        const formattedSeconds = String(seconds).padStart(2, '0');
        const formattedCentiseconds = String(centiseconds).padStart(2, '0');

        return `${formattedMinutes}:${formattedSeconds}.${formattedCentiseconds}`;
      }

      return {
        start,
        stop,
        reset,
        getElapsedTime,
      };
    }

    //creates a logfile
    function logAction(action) {
      //adding titles to column
      if(!logStarted){
            const logEntry = `{timestamp}; {timeRemaining}; {numberOfLinesCurrent}; {action}`;
            logStarted = true;
            logEntries.push(logEntry);
            
      }
      const timestamp = timeSinceStart.getElapsedTime();
      unclearedLines = grid.countFilledLines();
      const logEntry = `${timestamp}; ${timeRemaining.toFixed(1)}; ${unclearedLines}; ${action}`;
      logEntries.push(logEntry);
    }

    function downloadLogFile() {
      // Generate a downloadable text file with the log entries
      const logEntry =  `player ID: ${savedPlayerName}`;
      logEntries.push(logEntry);
      const logContent = logEntries.join('\n');
      const blob = new Blob([logContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);

      // Create an anchor element and set its attributes for download
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = `LOGFILE_Game:${logFileNumber}.txt`;
      logFileNumber += 1;
      downloadLink.style.display = 'none';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
}


