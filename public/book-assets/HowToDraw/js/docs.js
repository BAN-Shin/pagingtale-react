/**
 * 使用しているライブラリ: Turn.js
 * 著作権: ©2022 Turn.js Authors
 * ライセンス: BSD License
 * ライセンス詳細: "./js/license.txt"
 */

/* Documentation original */

function getTotalPages() {
	if (typeof window.TOTAL_PAGES === 'number' && window.TOTAL_PAGES > 0) {
		return window.TOTAL_PAGES;
	}
	return 28;
}

function getPageFilePath(page) {
	return './pages/mov_part_' + ("000" + page).slice(-3) + '.html';
}

function buildIframeHtml(page) {
	var filePath = getPageFilePath(page);

	return (
		'<div class="video-container">' +
			'<iframe ' +
				'id="iframe' + page + '" ' +
				'src="' + filePath + '" ' +
				'width="558" ' +
				'height="800" ' +
				'style="overflow: hidden;" ' +
				'sandbox="allow-scripts allow-same-origin allow-modals" ' +
				'frameborder="0" ' +
				'allowfullscreen>' +
			'</iframe>' +
		'</div>'
	);
}

function loadIframeToElement(element, page) {
	element.html(buildIframeHtml(page));
}

function addPage(page, book) {
	var totalPages = getTotalPages();
	var element = $('<div />', {});

	if (book.turn('addPage', element, page)) {
		// p1, p2 は index.html 側で最初から配置済み
		// 3ページ目以降を自動生成
		if (page >= 3 && page <= totalPages) {
			element.html('<div class="gradient"></div><div class="loader"></div>');
			loadIframeToElement(element, page);
		}
	}
}

function updateTabs() {
	var tabs = {7: 'Clases', 12:'Constructor', 14:'Properties', 16:'Methods', 25:'Events'},
		left = [],
		right = [],
		book = $('.original-docs'),
		actualPage = book.turn('page'),
		view = book.turn('view');

	for (var page in tabs) {
		var pageNum = parseInt(page, 10);
		var isHere = $.inArray(pageNum, view) !== -1;

		if (pageNum > actualPage && !isHere) {
			right.push('<a href="#page/' + pageNum + '">' + tabs[page] + '</a>');
		} else if (isHere) {
			if (pageNum % 2 === 0) {
				left.push('<a href="#page/' + pageNum + '" class="on">' + tabs[page] + '</a>');
			} else {
				right.push('<a href="#page/' + pageNum + '" class="on">' + tabs[page] + '</a>');
			}
		} else {
			left.push('<a href="#page/' + pageNum + '">' + tabs[page] + '</a>');
		}
	}

	$('.original-docs .tabs .left').html(left.join(''));
	$('.original-docs .tabs .right').html(right.join(''));
}

function numberOfViews(book) {
	return Math.ceil(book.turn('pages') / 2) + 1;
}

function getViewNumber(book, page) {
	return parseInt(((page || book.turn('page')) / 2) + 1, 10);
}

function moveBar(yes) {
	if (Modernizr && Modernizr.csstransforms) {
		$('#slider .ui-slider-handle').css({ zIndex: yes ? -1 : 10000 });
	}
}

function setPreview(view) {
	var previewWidth = 115,
		previewHeight = 73,
		previewSrc = 'pics/preview.jpg',
		preview = $(_thumbPreview.children(':first')),
		numPages = (view == 1 || view == $('#slider').slider('option', 'max')) ? 1 : 2,
		width = (numPages == 1) ? previewWidth / 2 : previewWidth;

	_thumbPreview
		.addClass('no-transition')
		.css({
			width: width + 15,
			height: previewHeight + 15,
			top: -previewHeight - 30,
			left: ($($('#slider').children(':first')).width() - width - 15) / 2
		});

	preview.css({
		width: width,
		height: previewHeight
	});

	if (preview.css('background-image') === '' || preview.css('background-image') === 'none') {
		preview.css({ backgroundImage: 'url(' + previewSrc + ')' });

		setTimeout(function() {
			_thumbPreview.removeClass('no-transition');
		}, 0);
	}

	preview.css({
		backgroundPosition: '0px -' + ((view - 1) * previewHeight) + 'px'
	});
}