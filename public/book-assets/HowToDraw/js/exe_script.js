// js\exe_script.js
// すべての動画でブラウザ標準 controls を優先し、独自の再生干渉を止める版

var currentIframeId;
var currentNumber;
var saveIframeId;
var JudgeVideoId;

var Page_next_flg = true;

var originalMaskSizes = {};
var originalVideoSizes = {};

var ClickFlgIframe = false;
var Iframe3StartFlgChild = false;

var playingAudios = [];
var iframeId;

// iframe 間データ受け渡し
function provideData() {
    return {
        maskSizes: originalMaskSizes,
        videoSizes: originalVideoSizes
    };
}

function receiveData(data) {
    originalMaskSizes = data.maskSizes || {};
    originalVideoSizes = data.videoSizes || {};
}

// 親から呼ばれる想定
function getSvg(currentIframeId) {
    var iframe = parent.document.getElementById(currentIframeId);

    if (iframe) {
        delayedExecutionInIframe(currentIframeId, 100, function() {
            initializeMaskSizes(currentIframeId);
        });
    }
}

document.addEventListener("DOMContentLoaded", function() {
    applyNativeVideoControls();
});

function applyNativeVideoControls() {
    var videos = document.querySelectorAll("video");

    videos.forEach(function(video) {
        // ブラウザ標準コントロールを表示
        video.controls = true;
        video.setAttribute("controls", "controls");

        // 端末によってはインライン再生を安定させる
        video.playsInline = true;
        video.setAttribute("playsinline", "playsinline");

        // 読み込みヒント
        if (!video.getAttribute("preload")) {
            video.setAttribute("preload", "metadata");
        }

        // 以前の独自 onended が残っていても上書き
        video.onended = null;

        // クリックが親SVGへ伝播して独自処理されないようにする
        video.addEventListener("click", function(e) {
            e.stopPropagation();
        });

        video.addEventListener("dblclick", function(e) {
            e.stopPropagation();
        });

        video.addEventListener("mousedown", function(e) {
            e.stopPropagation();
        });

        video.addEventListener("mouseup", function(e) {
            e.stopPropagation();
        });

        video.addEventListener("pointerdown", function(e) {
            e.stopPropagation();
        });

        video.addEventListener("pointerup", function(e) {
            e.stopPropagation();
        });
    });
}

function initializeMaskSizes(iframeIdTemp) {
    iframeId = iframeIdTemp;

    if (window.frameElement) {
        parent.currentIframeId = window.frameElement.id;
    }

    return new Promise(function(resolve) {
        var currentIframeNumber = parseInt(String(iframeId).replace("iframe", ""), 10);
        var targetIframeIds = [iframeId];

        if (!isNaN(currentIframeNumber)) {
            targetIframeIds.push("iframe" + currentIframeNumber);

            if (currentIframeNumber > 3) {
                if (currentIframeNumber % 2 === 0) {
                    targetIframeIds.push("iframe" + (currentIframeNumber + 1));
                } else {
                    targetIframeIds.push("iframe" + (currentIframeNumber - 1));
                }
            }
        }

        targetIframeIds.forEach(function(targetIframeId) {
            var iframe = parent.document.getElementById(targetIframeId);
            if (!iframe) return;

            var svgDocument = iframe.contentDocument || iframe.contentWindow.document;
            if (!svgDocument) return;

            var masks = svgDocument.querySelectorAll("mask");
            var videos = svgDocument.querySelectorAll("video");

            masks.forEach(function(mask) {
                var maskId = mask.id;
                if (!originalMaskSizes[maskId]) {
                    originalMaskSizes[maskId] = [];
                }

                var maskRects = mask.querySelectorAll('rect[fill="white"]');
                maskRects.forEach(function(rect) {
                    originalMaskSizes[maskId].push({
                        width: rect.getAttribute("width"),
                        height: rect.getAttribute("height"),
                        x: rect.getAttribute("x") || 0,
                        y: rect.getAttribute("y") || 0
                    });
                });
            });

            videos.forEach(function(video) {
                var videoId = video.id;
                var rect = video.getBoundingClientRect();

                if (!originalVideoSizes[videoId]) {
                    originalVideoSizes[videoId] = {};
                }

                originalVideoSizes[videoId] = {
                    width: video.clientWidth,
                    height: video.clientHeight,
                    x: rect.left,
                    y: rect.top
                };
            });
        });

        parent.postMessage({
            type: "maskAndVideoSizes",
            iframeId: iframeId,
            originalMaskSizes: originalMaskSizes,
            originalVideoSizes: originalVideoSizes
        }, "*");

        resolve();
    });
}

// 再生中の独自 Audio を止める互換関数
function stopAllPlayingAudios(judge_stop_mp3) {
    if (judge_stop_mp3 === true) {
        playingAudios.forEach(function(audio) {
            try {
                if (!audio.paused) {
                    audio.pause();
                }
                audio.currentTime = 0;
            } catch (e) {}
        });

        playingAudios = [];
    }
}

function resetSizesAndPositions() {
    var videoElements = document.querySelectorAll("video");

    videoElements.forEach(function(video) {
        var videoId = video.id;
        var originalVideoSize = originalVideoSizes[videoId];

        if (originalVideoSize) {
            resizeVideoElement(video, originalVideoSize.width, originalVideoSize.height);
            resetElementPositionVideo(video, originalVideoSize.x, originalVideoSize.y);
        }

        video.style.visibility = "visible";
    });

    var iframes = Array.from(parent.document.querySelectorAll("iframe"));

    iframes.forEach(function(iframe) {
        var svgDocument = iframe.contentDocument || iframe.contentWindow.document;
        if (!svgDocument) return;

        svgDocument.querySelectorAll("mask").forEach(function(mask) {
            var maskId = mask.id;
            var originalMaskSizesArray = originalMaskSizes[maskId];
            if (!originalMaskSizesArray) return;

            var match = maskId.match(/mov_(p\d+)_mask_(\d+)/i);
            var rectId = null;

            if (match && match.length > 2) {
                rectId = match[1] + "_K" + match[2].padStart(2, "0");
            }

            var relatedRect = rectId ? svgDocument.getElementById(rectId) : null;

            mask.querySelectorAll('rect[fill="white"]').forEach(function(rect, index) {
                var originalMaskSize = originalMaskSizesArray[index];
                if (!originalMaskSize) return;

                rect.setAttribute("width", originalMaskSize.width);
                rect.setAttribute("height", originalMaskSize.height);
                resetElementPositionSVG(rect, originalMaskSize.x, originalMaskSize.y);

                if (relatedRect) {
                    relatedRect.setAttribute("width", originalMaskSize.width);
                    relatedRect.setAttribute("height", originalMaskSize.height);
                    resetElementPositionSVG(relatedRect, originalMaskSize.x, originalMaskSize.y);
                }
            });
        });
    });

    document.body.style.backgroundColor = "#3F3631";
}

function toggleMaskSize(iframeIdValue, videoId, maskId) {
    resetSizesAndPositionsForIframe(iframeIdValue);

    var iframe = parent.document.getElementById(iframeIdValue);
    if (!iframe) return;

    var svgDocument = iframe.contentDocument || iframe.contentWindow.document;
    if (!svgDocument) return;

    var maskRects = svgDocument.querySelectorAll("#" + maskId + ' rect[fill="white"]');
    var videoElement = document.getElementById(videoId);
    if (!videoElement) return;

    var match = maskId.match(/mov_(p\d+)_mask_(\d+)/i);
    var rectId = null;

    if (match && match.length > 2) {
        rectId = match[1] + "_K" + match[2].padStart(2, "0");
    }

    var relatedRect = rectId ? svgDocument.getElementById(rectId) : null;

    maskRects.forEach(function(rect, index) {
        var maskInfoList = originalMaskSizes[maskId];
        var videoInfo = originalVideoSizes[videoId];

        if (!maskInfoList || !maskInfoList[index] || !videoInfo) return;

        var originalMaskWidth = maskInfoList[index].width;
        var originalMaskHeight = maskInfoList[index].height;
        var originalVideoWidth = videoInfo.width;
        var originalVideoHeight = videoInfo.height;

        var originalX = maskInfoList[index].x;
        var originalY = maskInfoList[index].y;

        var currentWidth = rect.getAttribute("width");
        var currentHeight = rect.getAttribute("height");

        if (currentWidth !== originalMaskWidth || currentHeight !== originalMaskHeight) {
            rect.setAttribute("width", originalMaskWidth);
            rect.setAttribute("height", originalMaskHeight);
            resetElementPositionSVG(rect, originalX, originalY);

            if (relatedRect) {
                relatedRect.setAttribute("width", originalMaskWidth);
                relatedRect.setAttribute("height", originalMaskHeight);
                resetElementPositionSVG(relatedRect, originalX, originalY);
            }

            resizeVideoElement(videoElement, originalVideoWidth, originalVideoHeight);
            resetElementPositionVideo(videoElement, originalX, originalY);
        }
    });
}

function resizeVideoElement(videoElement, width, height) {
    if (!videoElement) return;

    videoElement.style.width = width + "px";
    videoElement.style.height = height + "px";
}

function centerElementVideo(element, newWidthVideo, newHeightVideo) {
    var parentWidth = 558;
    var parentHeight = 820;

    var newLeft = (parentWidth - newWidthVideo) / 2;
    var newTop = (parentHeight - newHeightVideo) / 2;

    element.style.position = "absolute";
    element.style.left = newLeft + "px";
    element.style.top = newTop + "px";
}

function centerElementSVG(element, newWidthSVG, newHeightSVG) {
    var newX = (558 - newWidthSVG) / 2;
    var newY = (820 - newHeightSVG) / 2;

    element.setAttribute("x", newX);
    element.setAttribute("y", newY);
}

function resetElementPositionVideo(element, originalX, originalY) {
    element.style.position = "absolute";
    element.style.left = originalX + "px";
    element.style.top = originalY + "px";
}

function resetElementPositionSVG(element, originalX, originalY) {
    element.setAttribute("x", originalX);
    element.setAttribute("y", originalY);

    var btnOnElement = parent.document.getElementById("btnOn");
    var btnOffElement = parent.document.getElementById("btnOff");
    var musicOn = parent.document.getElementById("musicOn");
    var myOn = parent.document.getElementById("myTextbox");
    var myBtn = parent.document.getElementById("myButton");
    var clickableOff = parent.document.getElementById("clickableDiv");

    if (!btnOnElement || !btnOffElement) return;

    var isShownOn = btnOnElement.style.visibility === "visible" || btnOnElement.style.display !== "none";
    var isShownOff = btnOffElement.style.visibility === "visible" || btnOffElement.style.display !== "none";

    if (!isShownOff && !isShownOn) {
        btnOnElement.style.display = "block";
        if (musicOn) musicOn.style.display = "block";
        if (myOn) myOn.style.display = "block";
        if (myBtn) myBtn.style.display = "block";
        if (clickableOff) clickableOff.style.display = "block";
    }
}

// 互換のため残すが、独自再生制御はしない
function toggleVideoPlay(iframeIdValue, videoId, maskId) {
    var videoElement = document.getElementById(videoId);
    if (!videoElement) return;

    // controls 付き標準操作を優先するので、自動再生や停止切替はしない
    // 必要なら軽く見える状態だけ整える
    if (videoElement.controls !== true) {
        videoElement.controls = true;
        videoElement.setAttribute("controls", "controls");
    }
}

function stopAllVideosInAllIframes() {
    var iframes = parent.document.querySelectorAll("iframe");

    iframes.forEach(function(iframe) {
        if (iframe.contentWindow && typeof iframe.contentWindow.stopAllVideos === "function") {
            iframe.contentWindow.stopAllVideos();
        }
    });
}

function resetSizesAndPositionsForIframe(iframeIdValue) {
    var iframes = parent.document.querySelectorAll("iframe");

    iframes.forEach(function(iframe) {
        if (iframe.contentWindow && typeof iframe.contentWindow.resetSizesAndPositions === "function") {
            iframe.contentWindow.resetSizesAndPositions();
        }
    });
}

function stopAndRewindVideo(videoId) {
    var videoElements = document.querySelectorAll("video");

    videoElements.forEach(function(videoElement) {
        videoElement.pause();
        videoElement.currentTime = 0;
    });
}

function stopAllVideos() {
    document.querySelectorAll("video").forEach(function(video) {
        video.pause();
    });
}

// 以下は既存互換のため残す
function getNextVideoId(currentVideoId) {
    var part1 = currentVideoId.substring(0, 10);
    var part2 = currentVideoId.substring(currentVideoId.length - 2);

    var nextNumber = parseInt(part2, 10) + 1;
    var nextVideoId = part1 + nextNumber.toString().padStart(2, "0");

    if (document.getElementById(nextVideoId)) {
        return nextVideoId;
    } else {
        var numberPart = currentVideoId.match(/P(\d+)/);

        if (numberPart && numberPart.length > 1) {
            var pNumber = parseInt(numberPart[1], 10) + 2;

            if (pNumber % 2 === 1 && pNumber !== 27) {
                parent.$(".original-docs").turn("next");
                window.parent.iframe3StartFlg = true;
            }
        }

        currentIframeId = getIframeIdFromVideoId(nextVideoId);
        saveIframeId = currentIframeId;
        JudgeVideoId = getNextPageVideoId(nextVideoId);
        return JudgeVideoId;
    }
}

function getNextPageVideoId(currentVideoId) {
    var match = currentVideoId.match(/P(\d+)_K(\d+)/);

    if (match) {
        var pNumber = parseInt(match[1], 10) + 1;
        return "mov_P" + pNumber.toString().padStart(3, "0") + "_K01";
    } else {
        console.error("Invalid video ID format:", currentVideoId);
        return null;
    }
}

function getIframeIdFromVideoId(videoId) {
    var match = videoId.match(/P(\d+)_K\d+/);

    if (match) {
        var pNumber = parseInt(match[1], 10) + 3;
        return "iframe" + pNumber;
    } else {
        console.error("Invalid video ID format:", videoId);
        return null;
    }
}

function getNextIframeId(currentIframeIdValue) {
    var numberPart = parseInt(currentIframeIdValue.substring(6), 10);
    if (isNaN(numberPart)) {
        console.log("現在のiframe IDから数値を抽出できませんでした。");
        return null;
    }

    currentNumber = numberPart;
    return "iframe" + (numberPart + 1);
}

function delayedExecutionInIframe(iframeIdValue, delay, callback) {
    setTimeout(function() {
        var iframe = parent.document.getElementById(iframeIdValue);
        if (iframe) {
            var iframeDocument = iframe.contentDocument || iframe.contentWindow.document;
            callback(iframeDocument);
        } else {
            console.log(iframeIdValue + " が見つかりません");
        }
    }, delay);
}

function playVideoSeriesInIframeNext(startVideoId) {
    var iframeNext = parent.document.getElementById(currentIframeId);

    if (iframeNext) {
        delayedExecutionInIframe(currentIframeId, 1500, function(iframeDocument) {
            var videoElement = iframeDocument.getElementById(startVideoId);

            if (videoElement) {
                var maskId = startVideoId.replace("_K", "_mask_");
                var args = [currentIframeId, startVideoId, maskId];
                parent.delegateFunctionToIframe(currentIframeId, "toggleMaskSize", args, true);
            } else {
                console.log(currentIframeId + "内にビデオ要素" + startVideoId + "が見つかりません");
            }
        });
    } else {
        console.log("親ドキュメントに iframeNext が見つかりません");
    }
}

function playNextVideoInIframeNext(iframeDocument, videoId) {
    var videoElement = iframeDocument.getElementById(videoId);
    if (videoElement) {
        videoElement.onended = function() {
            var nextVideoId = getNextVideoIdBrother(videoId);
            if (nextVideoId) {
                playNextVideoInIframeNext(iframeDocument, nextVideoId);
            }
        };
    } else {
        console.log(videoId + "内にビデオ要素 " + videoId + " が見つかりません");
    }
}

function incrementVideoSeries(videoId) {
    var seriesNumber = parseInt(videoId.substring(5, 8), 10);
    var incrementedSeriesNumber = seriesNumber + 1;

    return videoId.substring(0, 5) + incrementedSeriesNumber.toString().padStart(3, "0") + "_K01";
}

function getNextVideoIdBrother(currentVideoId) {
    var part1 = currentVideoId.substring(0, 10);
    var part2 = currentVideoId.substring(currentVideoId.length - 2);

    var nextNumber = parseInt(part2, 10) + 1;
    var nextVideoId = part1 + nextNumber.toString().padStart(2, "0");

    var iframeNext = parent.document.getElementById(currentIframeId);
    if (iframeNext) {
        var iframeDocument = iframeNext.contentDocument || iframeNext.contentWindow.document;

        if (iframeDocument.getElementById(nextVideoId)) {
            return nextVideoId;
        } else {
            var videoElement = iframeDocument.getElementById(nextVideoId);

            currentIframeId = getNextIframeId(currentIframeId);
            nextVideoId = incrementVideoSeries(nextVideoId);

            if (currentNumber % 2 === 1 && videoElement == null) {
                parent.$(".original-docs").turn("next");
                window.parent.iframe3StartFlg = true;
            }

            playVideoSeriesInIframeNext(nextVideoId);
        }
    }

    return null;
}

function getNextMaskId(currentMaskId) {
    var match = currentMaskId.match(/(mov_P\d+)_mask_(\d+)/);
    if (match && match.length > 2) {
        var prefix = match[1];
        var numberPart = match[2];
        var nextNumber = parseInt(numberPart, 10) + 1;
        var nextMaskId = prefix + "_mask_" + nextNumber.toString().padStart(2, "0");

        if (document.getElementById(nextMaskId)) {
            return nextMaskId;
        } else {
            var prefixMatch = prefix.match(/(mov_P)(\d+)/);
            if (prefixMatch && prefixMatch.length > 2) {
                var pNumber = parseInt(prefixMatch[2], 10) + 1;
                var newPrefix = prefixMatch[1] + pNumber.toString().padStart(3, "0");
                var newMaskId = newPrefix + "_mask_01";

                if (document.getElementById(newMaskId)) {
                    return newMaskId;
                }
            }
        }
    }
    return null;
}

function getNextMaskIdNew(currentMaskId) {
    var match = currentMaskId.match(/(mov_P\d+)_mask_(\d+)/);
    if (match && match.length > 2) {
        var prefix = match[1];
        var numberPart = match[2];
        var nextNumber = parseInt(numberPart, 10) + 1;
        var nextMaskId = prefix + "_mask_" + nextNumber.toString().padStart(2, "0");

        if (document.getElementById(nextMaskId)) {
            return nextMaskId;
        } else {
            var prefixMatch = prefix.match(/(mov_P)(\d+)/);
            if (prefixMatch && prefixMatch.length > 2) {
                var pNumber = parseInt(prefixMatch[2], 10) + 1;
                var newPrefix = prefixMatch[1] + pNumber.toString().padStart(3, "0");
                return newPrefix + "_mask_01";
            }
        }
    }
    return null;
}

function logAllVideoIdsInIframe(iframeIdValue) {
    var iframe = parent.document.getElementById(iframeIdValue);
    if (iframe) {
        var iframeDocument = iframe.contentDocument || iframe.contentWindow.document;
        var videos = iframeDocument.getElementsByTagName("video");

        if (videos.length > 0) {
            console.log("動画のID一覧 in " + iframeIdValue + ":");
            for (var i = 0; i < videos.length; i++) {
                console.log(videos[i].id);
            }
        } else {
            console.log(iframeIdValue + " 内に動画要素はありません。");
        }
    } else {
        console.log("iframe " + iframeIdValue + " が見つかりません。");
    }
}

// ===== iframe内でも ← / → で親ブックのページ移動をできるようにする ここから =====

function isEditableTargetForArrowKey(target) {
    if (!target) return false;

    var tagName = target.tagName ? target.tagName.toLowerCase() : "";

    if (target.isContentEditable) return true;
    if (tagName === "textarea") return true;
    if (tagName === "select") return true;
    if (tagName === "button") return true;

    if (tagName === "input") {
        var inputType = (target.type || "").toLowerCase();

        // 文字入力系は左右キーをカーソル移動に使うので除外
        if (
            inputType === "text" ||
            inputType === "search" ||
            inputType === "url" ||
            inputType === "tel" ||
            inputType === "password" ||
            inputType === "email" ||
            inputType === "number" ||
            inputType === ""
        ) {
            return true;
        }
    }

    return false;
}

function requestParentTurnPageByArrow(direction) {
    try {
        if (!window.parent) return;

        // まずは親の turn.js を直接使う
        if (
            window.parent.$ &&
            window.parent.$(".original-docs").length &&
            typeof window.parent.$(".original-docs").turn === "function" &&
            window.parent.$(".original-docs").turn("is")
        ) {
            if (direction === "previous") {
                window.parent.$(".original-docs").turn("previous");
            } else if (direction === "next") {
                window.parent.$(".original-docs").turn("next");
            }

            var currentPage = window.parent.$(".original-docs").turn("page");

            if (
                window.parent.Hash &&
                typeof window.parent.Hash.go === "function"
            ) {
                window.parent.Hash.go("page/" + currentPage).update();
            }

            return;
        }

        // direct操作が使えない場合は postMessage でフォールバック
        window.parent.postMessage({
            type: "turnByArrow",
            direction: direction
        }, "*");

    } catch (e) {
        console.error("親ページへの矢印キー連携に失敗しました:", e);
    }
}

function setupIframeArrowPageNavigation() {
    if (window.__iframeArrowPageNavigationInitialized) return;
    window.__iframeArrowPageNavigationInitialized = true;

    document.addEventListener("keydown", function(e) {
        var key = e.key || "";
        var keyCode = e.keyCode || 0;
        var target = e.target;

        // 入力中の要素では邪魔しない
        if (isEditableTargetForArrowKey(target)) {
            return;
        }

        // video要素にフォーカスしている場合は邪魔しない寄りにする
        if (target && target.tagName && target.tagName.toLowerCase() === "video") {
            return;
        }

        if (key === "ArrowLeft" || keyCode === 37) {
            e.preventDefault();
            e.stopPropagation();
            requestParentTurnPageByArrow("previous");
            return;
        }

        if (key === "ArrowRight" || keyCode === 39) {
            e.preventDefault();
            e.stopPropagation();
            requestParentTurnPageByArrow("next");
            return;
        }
    }, true);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupIframeArrowPageNavigation);
} else {
    setupIframeArrowPageNavigation();
}

// ===== iframe内でも ← / → で親ブックのページ移動をできるようにする ここまで =====