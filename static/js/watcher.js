var watcher = {};

watcher.init = function() {

  watcher.isInThread = Boolean(document.getElementById('threadIdentifier'));
  watcher.watcherAlertCounter = 0;
  watcher.elementRelation = {};
  watcher.counters = [];

  var watchDiv = interfaceUtils.buildFloatingMenu('watchedMenu', 'Watched Threads');
  watchDiv.parentNode.style.display = 'none';

  watcher.watchedMenu = document.createElement('table');
  watchDiv.append(watcher.watchedMenu);

  Array.from(document.getElementsByClassName('watcherButton'))
    .forEach((watcherButton) => {
      watcherButton.title = 'Watched Threads';
    
      watcherButton.onclick = function(e) {
        // e.preventDefault(); // uncomment to keep menu open
        if (watchDiv.parentNode.style.display == 'block')
          watchDiv.parentNode.style.display = 'none';
        else
          watchDiv.parentNode.style.display = 'block';
      }

      var watcherCounter = document.createElement('span');
      watcherButton.appendChild(watcherCounter);
      watcher.counters.push(watcherCounter);
  });

  var storedWatchedData = watcher.getStoredWatchedData();

  for ( var currentBoard in storedWatchedData) {

    if (storedWatchedData.hasOwnProperty(currentBoard)) {

      var threads = storedWatchedData[currentBoard];

      for ( var thread in threads) {
        if (threads.hasOwnProperty(thread)) {

          if (watcher.isInThread && currentBoard == api.boardUri
              && thread == api.threadId) {
            threads[thread].lastSeen = new Date().getTime();
            localStorage.watchedData = JSON.stringify(storedWatchedData);
          }

          watcher.addWatchedCell(currentBoard, thread, threads[thread]);
        }
      }
    }

  }

  watcher.updateWatcherCounter();

  watcher.scheduleWatchedThreadsCheck();

};

watcher.updateWatcherCounter = function() {

  watcher.counters.forEach((watcherCounter) => {

    if (watcher.watcherAlertCounter) {
      watcherCounter.parentNode.classList.add('mobileAlert');
    } else {
      watcherCounter.parentNode.classList.remove('mobileAlert');
    }

    watcherCounter.textContent = watcher.watcherAlertCounter ? '('
        + watcher.watcherAlertCounter + ')' : '';
  })

};

watcher.getStoredWatchedData = function() {

  var storedWatchedData = localStorage.watchedData;

  if (storedWatchedData) {
    storedWatchedData = JSON.parse(storedWatchedData);
  } else {
    storedWatchedData = {};
  }

  return storedWatchedData;

};

watcher.processThread = function(urls, index, data) {

  data = JSON.parse(data);
  var url = urls[index];

  var posts = data.posts;

  if (posts && posts.length) {

    var lastPost = posts[posts.length - 1];

    var parsedCreation = new Date(lastPost.creation);

    var storedWatchedData = watcher.getStoredWatchedData();

    var watchData = storedWatchedData[url.board][url.thread];

    if (parsedCreation.getTime() > watchData.lastReplied) {
      watchData.lastReplied = parsedCreation.getTime();
      localStorage.watchedData = JSON.stringify(storedWatchedData);
    }

    if (!watcher.elementRelation[url.board]
        || !watcher.elementRelation[url.board][url.thread]) {
      watcher.addWatchedCell(url.board, url.thread, watchData);
    } else if (watchData.lastSeen >= watchData.lastReplied) {
      watcher.elementRelation[url.board][url.thread].style.display = 'none';
    } else {
      watcher.watcherAlertCounter++;
      watcher.elementRelation[url.board][url.thread].style.display = 'inline';
    }

  }

  watcher.iterateWatchedThreads(urls, ++index);

};

watcher.iterateWatchedThreads = function(urls, index) {

  index = index || 0;

  if (index >= urls.length) {
    watcher.updateWatcherCounter();
    watcher.scheduleWatchedThreadsCheck();
    return;
  }

  var url = urls[index];

  api.localRequest('/' + url.board + '/res/' + url.thread + '.json',
      function gotThreadInfo(error, data) {

        if (error) {
          watcher.iterateWatchedThreads(urls, ++index);
        } else {
          watcher.processThread(urls, index, data);
        }

      });

};

watcher.runWatchedThreadsCheck = function() {

  watcher.watcherAlertCounter = 0;

  localStorage.lastWatchCheck = new Date().getTime();

  var urls = [];

  var storedWatchedData = watcher.getStoredWatchedData();

  for ( var board in storedWatchedData) {

    if (storedWatchedData.hasOwnProperty(board)) {

      var threads = storedWatchedData[board];

      for ( var thread in threads) {
        if (threads.hasOwnProperty(thread)) {

          if (watcher.isInThread && board == api.boardUri
              && thread == api.threadId) {
            threads[thread].lastSeen = new Date().getTime();
            localStorage.watchedData = JSON.stringify(storedWatchedData);
          }

          urls.push({
            board : board,
            thread : thread
          });
        }
      }
    }

  }

  watcher.iterateWatchedThreads(urls);

};

watcher.scheduleWatchedThreadsCheck = function() {

  var lastCheck = localStorage.lastWatchCheck;

  if (!lastCheck) {
    watcher.runWatchedThreadsCheck();
    return;
  }

  lastCheck = new Date(+lastCheck);

  // lastCheck.setUTCMinutes(lastCheck.getUTCMinutes() + 5);
  lastCheck.setUTCSeconds(lastCheck.getUTCSeconds() + 10);

  setTimeout(function() {
    watcher.runWatchedThreadsCheck();
  }, lastCheck.getTime() - new Date().getTime());

}

watcher.addWatchedCell = function(board, thread, watchData) {

  var cellWrapper = document.createElement('tr');

  var cell = document.createElement('td');
  cell.className = 'watchedCell';

  var labelWrapper = document.createElement('label');
  labelWrapper.className = 'watchedCellLabel';

  var label = document.createElement('a');

  label.innerText = watchData.label || (board + '/' + thread);
  label.href = '/' + board + '/res/' + thread + '.html';
  labelWrapper.appendChild(label);

  var notification = document.createElement('span');
  notification.className = 'watchedNotification';

  if (!watcher.elementRelation[board]) {
    watcher.elementRelation[board] = {};
  }

  watcher.elementRelation[board][thread] = notification;

  if (watchData.lastSeen >= watchData.lastReplied) {
    notification.style.display = 'none';
  } else {
    watcher.watcherAlertCounter++;
  }

  labelWrapper.appendChild(notification);

  cell.appendChild(labelWrapper);

  cellWrapper.appendChild(cell);

  var markRead = document.createElement('td');
  markRead.title = "Mark as read";
  markRead.className = 'watchedCellDismissButton glowOnHover coloredIcon';
  cellWrapper.appendChild(markRead);

  markRead.onclick = function() {

    // watcher.watchedMenu.removeChild(cellWrapper);

    var storedWatchedData = watcher.getStoredWatchedData();

    var boardThreads = storedWatchedData[board];

    if (!boardThreads || !boardThreads[thread]) {
      return;
    }

    boardThreads[thread].lastSeen = boardThreads[thread].lastReplied;

    localStorage.watchedData = JSON.stringify(storedWatchedData);

    watcher.updateWatcherCounter();

  }

  var button = document.createElement('td');
  button.className = 'removeButton glowOnHover coloredIcon';
  cellWrapper.appendChild(button);

  button.onclick = function() {

    watcher.watchedMenu.removeChild(cellWrapper);

    var storedWatchedData = watcher.getStoredWatchedData();

    var boardThreads = storedWatchedData[board];

    if (!boardThreads || !boardThreads[thread]) {
      return;
    }

    delete boardThreads[thread];

    localStorage.watchedData = JSON.stringify(storedWatchedData);

  }
/*
  cellWrapper.appendChild(document.createElement('hr'));
*/
  watcher.watchedMenu.appendChild(cellWrapper);

};

watcher.processOP = function(op) {

  var checkBox = op.getElementsByClassName('watcheButton')[0];

  var nameParts = checkBox.name.split('-');

  var board = nameParts[0];
  var thread = nameParts[1];

  var watchButton = document.createElement('span');
  watchButton.className = 'watchButton glowOnHover coloredIcon';
  watchButton.title = "Watch Thread";

  checkBox.parentNode.insertBefore(watchButton,
      checkBox.nextSibling.nextSibling.nextSibling);

  watchButton.onclick = function() {

    var storedWatchedData = watcher.getStoredWatchedData();

    var boardThreads = storedWatchedData[board] || {};

    if (boardThreads[thread]) {
      return;
    }

    var subject = op.getElementsByClassName('labelSubject');
    var message = op.getElementsByClassName('divMessage')[0];

    var label = (subject.length ? subject[0].innerText : null)
        || message.innerHTML.replace(/(<([^>]+)>)/ig, "").substr(0, 16).trim();

    if (!label.length) {
      label = null;
    } else {
      label = label.replace(/[<>"']/g, function(match) {
        return api.htmlReplaceTable[match]
      });
    }

    boardThreads[thread] = {
      lastSeen : new Date().getTime(),
      lastReplied : new Date().getTime(),
      label : label
    };

    storedWatchedData[board] = boardThreads;

    localStorage.watchedData = JSON.stringify(storedWatchedData);

    watcher.addWatchedCell(board, thread, boardThreads[thread]);

  };

};

watcher.init();
