VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} frmLessonEditor 
   Caption         =   "Lesson"
   ClientHeight    =   10305
   ClientLeft      =   120
   ClientTop       =   465
   ClientWidth     =   9375.001
   OleObjectBlob   =   "frmLessonEditor.frx":0000
   StartUpPosition =   1  'オーナー フォームの中央
End
Attribute VB_Name = "frmLessonEditor"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Explicit

Private Const TEST_NONE_LABEL As String = "(なし)"

Private Sub UserForm_Initialize()
    SetDefaultValues
    ApplyUiSettings
    LoadTestIdOptions
    RefreshLessonPreview
End Sub

Private Sub SetDefaultValues()
    Dim activeBookId As String

    On Error Resume Next
    activeBookId = GetConfigValue("activeBookId")
    On Error GoTo 0

    txtBookId.text = activeBookId
    txtLessonNo.text = ""
    txtLessonIdPreview.text = ""
    txtLessonTitle.text = ""
    txtTheme.text = ""
    txtLearningObjective.text = ""
    txtStartPage.text = ""
    txtEndPage.text = ""
    txtDifficulty.text = ""
    txtEstimatedMinutes.text = ""
    txtPublishPages.text = ""
    txtPublishQuestions.text = ""
    txtDescription.text = ""

    On Error Resume Next
    cmbTestId.ListIndex = -1
    cmbTestId.value = TEST_NONE_LABEL
    On Error GoTo 0
End Sub

Private Sub ApplyUiSettings()
    Me.Caption = "レッスンエディタ"

    txtLessonIdPreview.Locked = True
    txtLessonIdPreview.BackColor = RGB(240, 240, 240)
    txtLessonIdPreview.Multiline = True
    txtLessonIdPreview.EnterKeyBehavior = True
    txtLessonIdPreview.WordWrap = True
    On Error Resume Next
    txtLessonIdPreview.ScrollBars = fmScrollBarsVertical
    On Error GoTo 0

    txtLearningObjective.Multiline = True
    txtLearningObjective.EnterKeyBehavior = True
    txtLearningObjective.WordWrap = True
    On Error Resume Next
    txtLearningObjective.ScrollBars = fmScrollBarsVertical
    On Error GoTo 0

    txtDescription.Multiline = True
    txtDescription.EnterKeyBehavior = True
    txtDescription.WordWrap = True
    On Error Resume Next
    txtDescription.ScrollBars = fmScrollBarsVertical
    On Error GoTo 0

    On Error Resume Next
    cmbTestId.Style = fmStyleDropDownList
    On Error GoTo 0
End Sub

Private Sub LoadTestIdOptions()
    On Error GoTo ErrHandler

    Dim wsTests As Worksheet
    Dim lastRow As Long
    Dim rowIndex As Long

    Dim colTestId As Long
    Dim colBookId As Long
    Dim colTestTitle As Long

    Dim currentBookId As String
    Dim testId As String
    Dim testTitle As String
    Dim selectedValue As String

    selectedValue = ""
    On Error Resume Next
    selectedValue = Trim$(CStr(cmbTestId.value))
    On Error GoTo 0

    currentBookId = Trim$(txtBookId.text)

    Set wsTests = GetSheetByConfigOrName("testsSheetName", "Tests")
    colTestId = FindHeaderColumn(wsTests, "testId")
    colBookId = FindHeaderColumn(wsTests, "bookId")
    colTestTitle = TryFindHeaderColumn(wsTests, "testTitle")

    cmbTestId.Clear
    cmbTestId.AddItem TEST_NONE_LABEL

    lastRow = wsTests.Cells(wsTests.Rows.count, colTestId).End(xlUp).Row

    For rowIndex = 2 To lastRow
        testId = Trim$(CStr(wsTests.Cells(rowIndex, colTestId).value))

        If Len(testId) > 0 Then
            If Len(currentBookId) = 0 _
               Or StrComp(Trim$(CStr(wsTests.Cells(rowIndex, colBookId).value)), currentBookId, vbTextCompare) = 0 Then

                If colTestTitle > 0 Then
                    testTitle = Trim$(CStr(wsTests.Cells(rowIndex, colTestTitle).value))
                Else
                    testTitle = ""
                End If

                cmbTestId.AddItem BuildTestComboDisplay(testId, testTitle)
            End If
        End If
    Next rowIndex

    If Len(selectedValue) > 0 Then
        TrySelectTestComboValue selectedValue
    Else
        cmbTestId.value = TEST_NONE_LABEL
    End If

    Exit Sub

ErrHandler:
    MsgBox "Tests 一覧の読み込みに失敗しました。" & vbCrLf & Err.description, vbExclamation
End Sub

Private Function BuildTestComboDisplay(ByVal testId As String, ByVal testTitle As String) As String
    If Len(Trim$(testTitle)) > 0 Then
        BuildTestComboDisplay = Trim$(testId) & " : " & Trim$(testTitle)
    Else
        BuildTestComboDisplay = Trim$(testId)
    End If
End Function

Private Sub TrySelectTestComboValue(ByVal rawValue As String)
    Dim i As Long
    Dim targetTestId As String

    targetTestId = ExtractTestIdFromComboValue(rawValue)

    If Len(targetTestId) = 0 Then
        cmbTestId.value = TEST_NONE_LABEL
        Exit Sub
    End If

    For i = 0 To cmbTestId.ListCount - 1
        If StrComp(ExtractTestIdFromComboValue(CStr(cmbTestId.List(i))), targetTestId, vbTextCompare) = 0 Then
            cmbTestId.ListIndex = i
            Exit Sub
        End If
    Next i

    cmbTestId.value = TEST_NONE_LABEL
End Sub

Private Function ExtractTestIdFromComboValue(ByVal comboValue As String) As String
    Dim text As String
    Dim pos As Long

    text = Trim$(comboValue)

    If Len(text) = 0 Then
        ExtractTestIdFromComboValue = ""
        Exit Function
    End If

    If StrComp(text, TEST_NONE_LABEL, vbTextCompare) = 0 Then
        ExtractTestIdFromComboValue = ""
        Exit Function
    End If

    pos = InStr(1, text, " : ", vbTextCompare)

    If pos > 0 Then
        ExtractTestIdFromComboValue = Trim$(Left$(text, pos - 1))
    Else
        ExtractTestIdFromComboValue = text
    End If
End Function

Private Sub btnPreviewId_Click()
    RefreshLessonPreview
End Sub

Private Sub btnSave_Click()
    On Error GoTo ErrHandler

    Dim wsLessons As Worksheet
    Dim nextRow As Long

    Dim colLessonId As Long
    Dim colBookId As Long
    Dim colLessonNo As Long
    Dim colLessonTitle As Long
    Dim colTheme As Long
    Dim colLearningObjective As Long
    Dim colStartPage As Long
    Dim colEndPage As Long
    Dim colDifficulty As Long
    Dim colEstimatedMinutes As Long
    Dim colTestId As Long
    Dim colPublishPages As Long
    Dim colPublishQuestions As Long
    Dim colDescription As Long
    Dim colCreatedAt As Long

    Dim bookId As String
    Dim bookShort As String
    Dim lessonNo As Long
    Dim lessonId As String
    Dim selectedTestId As String

    bookId = Trim$(txtBookId.text)

    If Len(bookId) = 0 Then
        MsgBox "教材IDを入力してください。", vbExclamation
        Exit Sub
    End If

    If Len(Trim$(txtLessonNo.text)) = 0 Or Not IsNumeric(txtLessonNo.text) Then
        MsgBox "レッスン番号は数値で入力してください。", vbExclamation
        Exit Sub
    End If

    If Len(Trim$(txtLessonTitle.text)) = 0 Then
        MsgBox "レッスンタイトルを入力してください。", vbExclamation
        Exit Sub
    End If

    If Len(Trim$(txtStartPage.text)) > 0 And Not IsNumeric(txtStartPage.text) Then
        MsgBox "開始ページは数値で入力してください。", vbExclamation
        Exit Sub
    End If

    If Len(Trim$(txtEndPage.text)) > 0 And Not IsNumeric(txtEndPage.text) Then
        MsgBox "終了ページは数値で入力してください。", vbExclamation
        Exit Sub
    End If

    If Len(Trim$(txtStartPage.text)) > 0 And Len(Trim$(txtEndPage.text)) > 0 Then
        If CLng(Val(txtStartPage.text)) > CLng(Val(txtEndPage.text)) Then
            MsgBox "開始ページは終了ページ以下にしてください。", vbExclamation
            Exit Sub
        End If
    End If

    If Len(Trim$(txtEstimatedMinutes.text)) > 0 And Not IsNumeric(txtEstimatedMinutes.text) Then
        MsgBox "想定時間は数値で入力してください。", vbExclamation
        Exit Sub
    End If

    selectedTestId = ExtractTestIdFromComboValue(CStr(cmbTestId.value))

    If Len(selectedTestId) > 0 Then
        If Not TestIdExistsForBook(bookId, selectedTestId) Then
            MsgBox "選択された testId が Tests シートに見つかりません。" & vbCrLf & selectedTestId, vbExclamation
            Exit Sub
        End If
    End If

    Set wsLessons = GetSheetByConfigOrName("lessonsSheetName", "Lessons")

    colLessonId = FindHeaderColumn(wsLessons, "lessonId")
    colBookId = FindHeaderColumn(wsLessons, "bookId")
    colLessonNo = FindHeaderColumn(wsLessons, "lessonNo")
    colLessonTitle = FindHeaderColumn(wsLessons, "lessonTitle")
    colTheme = FindHeaderColumn(wsLessons, "theme")
    colLearningObjective = FindHeaderColumn(wsLessons, "learningObjective")
    colStartPage = FindHeaderColumn(wsLessons, "startPage")
    colEndPage = FindHeaderColumn(wsLessons, "endPage")
    colDifficulty = FindHeaderColumn(wsLessons, "difficulty")
    colEstimatedMinutes = FindHeaderColumn(wsLessons, "estimatedMinutes")
    colTestId = FindHeaderColumn(wsLessons, "testId")
    colPublishPages = FindHeaderColumn(wsLessons, "publishPages")
    colPublishQuestions = FindHeaderColumn(wsLessons, "publishQuestions")
    colDescription = FindHeaderColumn(wsLessons, "description")
    colCreatedAt = TryFindHeaderColumn(wsLessons, "createdAt")

    lessonNo = CLng(Val(txtLessonNo.text))
    bookShort = ResolveBookShort(bookId)
    lessonId = BuildLessonId(bookShort, lessonNo)

    If LessonIdAlreadyExists(wsLessons, colLessonId, colBookId, lessonId, bookId) Then
        If MsgBox("同じ lessonId が既に存在します。" & vbCrLf & _
                  lessonId & vbCrLf & vbCrLf & _
                  "そのまま追加しますか？", vbQuestion + vbYesNo) <> vbYes Then
            Exit Sub
        End If
    End If

    nextRow = GetNextDataRow(wsLessons)

    wsLessons.Cells(nextRow, colLessonId).value = lessonId
    wsLessons.Cells(nextRow, colBookId).value = bookId
    wsLessons.Cells(nextRow, colLessonNo).value = lessonNo
    wsLessons.Cells(nextRow, colLessonTitle).value = Trim$(txtLessonTitle.text)
    wsLessons.Cells(nextRow, colTheme).value = Trim$(txtTheme.text)
    wsLessons.Cells(nextRow, colLearningObjective).value = Trim$(txtLearningObjective.text)

    If Len(Trim$(txtStartPage.text)) > 0 Then
        wsLessons.Cells(nextRow, colStartPage).value = CLng(Val(txtStartPage.text))
    Else
        wsLessons.Cells(nextRow, colStartPage).value = ""
    End If

    If Len(Trim$(txtEndPage.text)) > 0 Then
        wsLessons.Cells(nextRow, colEndPage).value = CLng(Val(txtEndPage.text))
    Else
        wsLessons.Cells(nextRow, colEndPage).value = ""
    End If

    wsLessons.Cells(nextRow, colDifficulty).value = Trim$(txtDifficulty.text)

    If Len(Trim$(txtEstimatedMinutes.text)) > 0 Then
        wsLessons.Cells(nextRow, colEstimatedMinutes).value = CLng(Val(txtEstimatedMinutes.text))
    Else
        wsLessons.Cells(nextRow, colEstimatedMinutes).value = ""
    End If

    wsLessons.Cells(nextRow, colTestId).value = selectedTestId
    wsLessons.Cells(nextRow, colPublishPages).value = NormalizeDelimitedText(txtPublishPages.text)
    wsLessons.Cells(nextRow, colPublishQuestions).value = NormalizeDelimitedText(txtPublishQuestions.text)
    wsLessons.Cells(nextRow, colDescription).value = Trim$(txtDescription.text)

    If colCreatedAt > 0 Then
        wsLessons.Cells(nextRow, colCreatedAt).value = Format$(Now, "yyyy-mm-dd hh:nn:ss")
    End If

    RefreshLessonPreview

    MsgBox "Lessons シートに保存しました。" & vbCrLf & lessonId, vbInformation

    ClearForNextEntry
    Exit Sub

ErrHandler:
    MsgBox "保存時にエラーが発生しました。" & vbCrLf & Err.description, vbCritical
End Sub

Private Sub btnClose_Click()
    Unload Me
End Sub

Private Sub txtBookId_AfterUpdate()
    LoadTestIdOptions
    RefreshLessonPreview
End Sub

Private Sub txtLessonNo_AfterUpdate()
    RefreshLessonPreview
End Sub

Private Sub txtBookId_Change()
    LoadTestIdOptions
    RefreshLessonPreview
End Sub

Private Sub txtLessonNo_Change()
    RefreshLessonPreview
End Sub

Private Sub cmbTestId_Change()
    RefreshLessonPreview
End Sub

Private Sub RefreshLessonPreview()
    On Error GoTo SafeExit

    Dim bookId As String
    Dim bookShort As String
    Dim lessonNo As Long
    Dim lessonId As String
    Dim previewText As String
    Dim selectedTestId As String

    bookId = Trim$(txtBookId.text)

    If Len(bookId) = 0 Then
        txtLessonIdPreview.text = ""
        Exit Sub
    End If

    If Len(Trim$(txtLessonNo.text)) = 0 Or Not IsNumeric(txtLessonNo.text) Then
        txtLessonIdPreview.text = ""
        Exit Sub
    End If

    bookShort = ResolveBookShort(bookId)
    lessonNo = CLng(Val(txtLessonNo.text))
    lessonId = BuildLessonId(bookShort, lessonNo)

    previewText = lessonId & vbCrLf & BuildLessonPreviewDetail(bookId, lessonId)

    selectedTestId = ExtractTestIdFromComboValue(CStr(cmbTestId.value))
    If Len(selectedTestId) > 0 Then
        previewText = previewText & vbCrLf & "選択テスト: " & selectedTestId
    Else
        previewText = previewText & vbCrLf & "選択テスト: なし"
    End If

    txtLessonIdPreview.text = previewText

SafeExit:
End Sub

Private Function BuildLessonPreviewDetail(ByVal bookId As String, ByVal lessonId As String) As String
    On Error GoTo NotFound

    Dim wsLessons As Worksheet
    Dim lastRow As Long
    Dim rowIndex As Long

    Dim colBookId As Long
    Dim colLessonId As Long
    Dim colLessonTitle As Long
    Dim colStartPage As Long
    Dim colEndPage As Long
    Dim colTheme As Long

    Dim lessonTitle As String
    Dim startPageText As String
    Dim endPageText As String
    Dim themeText As String
    Dim detailText As String

    Set wsLessons = GetSheetByConfigOrName("lessonsSheetName", "Lessons")

    colBookId = FindHeaderColumn(wsLessons, "bookId")
    colLessonId = FindHeaderColumn(wsLessons, "lessonId")
    colLessonTitle = FindHeaderColumn(wsLessons, "lessonTitle")
    colStartPage = FindHeaderColumn(wsLessons, "startPage")
    colEndPage = FindHeaderColumn(wsLessons, "endPage")
    colTheme = TryFindHeaderColumn(wsLessons, "theme")

    lastRow = wsLessons.Cells(wsLessons.Rows.count, colLessonId).End(xlUp).Row

    For rowIndex = 2 To lastRow
        If StrComp(Trim$(CStr(wsLessons.Cells(rowIndex, colBookId).value)), Trim$(bookId), vbTextCompare) = 0 _
           And StrComp(Trim$(CStr(wsLessons.Cells(rowIndex, colLessonId).value)), Trim$(lessonId), vbTextCompare) = 0 Then

            lessonTitle = Trim$(CStr(wsLessons.Cells(rowIndex, colLessonTitle).value))
            startPageText = Trim$(CStr(wsLessons.Cells(rowIndex, colStartPage).value))
            endPageText = Trim$(CStr(wsLessons.Cells(rowIndex, colEndPage).value))

            If colTheme > 0 Then
                themeText = Trim$(CStr(wsLessons.Cells(rowIndex, colTheme).value))
            Else
                themeText = ""
            End If

            detailText = ""

            If Len(lessonTitle) > 0 Then
                detailText = lessonTitle
            End If

            If Len(themeText) > 0 Then
                If Len(detailText) > 0 Then detailText = detailText & vbCrLf
                detailText = detailText & "テーマ: " & themeText
            End If

            If Len(startPageText) > 0 Or Len(endPageText) > 0 Then
                If Len(detailText) > 0 Then detailText = detailText & vbCrLf
                detailText = detailText & "ページ: " & startPageText & " - " & endPageText
            End If

            If Len(detailText) = 0 Then
                detailText = "Lessons シートに登録済み"
            End If

            BuildLessonPreviewDetail = detailText
            Exit Function
        End If
    Next rowIndex

NotFound:
    BuildLessonPreviewDetail = "※ Lessons シートに未登録"
End Function

Private Sub ClearForNextEntry()
    txtLessonNo.text = ""
    txtLessonIdPreview.text = ""
    txtLessonTitle.text = ""
    txtTheme.text = ""
    txtLearningObjective.text = ""
    txtStartPage.text = ""
    txtEndPage.text = ""
    txtDifficulty.text = ""
    txtEstimatedMinutes.text = ""
    txtPublishPages.text = ""
    txtPublishQuestions.text = ""
    txtDescription.text = ""

    On Error Resume Next
    cmbTestId.ListIndex = -1
    cmbTestId.value = TEST_NONE_LABEL
    On Error GoTo 0
End Sub

Private Function LessonIdAlreadyExists( _
    ByVal wsLessons As Worksheet, _
    ByVal lessonIdCol As Long, _
    ByVal bookIdCol As Long, _
    ByVal lessonId As String, _
    ByVal bookId As String _
) As Boolean
    Dim lastRow As Long
    Dim rowIndex As Long

    lastRow = wsLessons.Cells(wsLessons.Rows.count, lessonIdCol).End(xlUp).Row

    For rowIndex = 2 To lastRow
        If StrComp(Trim$(CStr(wsLessons.Cells(rowIndex, lessonIdCol).value)), Trim$(lessonId), vbTextCompare) = 0 _
           And StrComp(Trim$(CStr(wsLessons.Cells(rowIndex, bookIdCol).value)), Trim$(bookId), vbTextCompare) = 0 Then
            LessonIdAlreadyExists = True
            Exit Function
        End If
    Next rowIndex

    LessonIdAlreadyExists = False
End Function

Private Function TestIdExistsForBook(ByVal bookId As String, ByVal testId As String) As Boolean
    Dim wsTests As Worksheet
    Dim lastRow As Long
    Dim rowIndex As Long
    Dim colTestId As Long
    Dim colBookId As Long

    If Len(Trim$(testId)) = 0 Then
        TestIdExistsForBook = True
        Exit Function
    End If

    Set wsTests = GetSheetByConfigOrName("testsSheetName", "Tests")
    colTestId = FindHeaderColumn(wsTests, "testId")
    colBookId = FindHeaderColumn(wsTests, "bookId")

    lastRow = wsTests.Cells(wsTests.Rows.count, colTestId).End(xlUp).Row

    For rowIndex = 2 To lastRow
        If StrComp(Trim$(CStr(wsTests.Cells(rowIndex, colTestId).value)), Trim$(testId), vbTextCompare) = 0 _
           And StrComp(Trim$(CStr(wsTests.Cells(rowIndex, colBookId).value)), Trim$(bookId), vbTextCompare) = 0 Then
            TestIdExistsForBook = True
            Exit Function
        End If
    Next rowIndex

    TestIdExistsForBook = False
End Function

Private Function NormalizeDelimitedText(ByVal value As String) As String
    Dim text As String

    text = Trim$(value)
    text = Replace(text, "，", ",")
    text = Replace(text, "、", ",")
    text = Replace(text, " ,", ",")
    text = Replace(text, ", ", ",")

    Do While InStr(text, ",,") > 0
        text = Replace(text, ",,", ",")
    Loop

    If Len(text) > 0 Then
        If Left$(text, 1) = "," Then text = Mid$(text, 2)
        If Len(text) > 0 Then
            If Right$(text, 1) = "," Then text = Left$(text, Len(text) - 1)
        End If
    End If

    NormalizeDelimitedText = text
End Function

Private Function GetSheetByConfigOrName(ByVal configKey As String, ByVal fallbackName As String) As Worksheet
    Dim sheetName As String

    On Error Resume Next
    sheetName = Trim$(GetConfigValue(configKey))
    On Error GoTo 0

    If Len(sheetName) = 0 Then
        sheetName = fallbackName
    End If

    Set GetSheetByConfigOrName = ThisWorkbook.Worksheets(sheetName)
End Function

Private Function GetConfigValue(ByVal keyName As String) As String
    Dim ws As Worksheet
    Dim lastRow As Long
    Dim rowIndex As Long

    Set ws = ThisWorkbook.Worksheets("Config")
    lastRow = ws.Cells(ws.Rows.count, 1).End(xlUp).Row

    For rowIndex = 2 To lastRow
        If StrComp(Trim$(CStr(ws.Cells(rowIndex, 1).value)), Trim$(keyName), vbTextCompare) = 0 Then
            GetConfigValue = Trim$(CStr(ws.Cells(rowIndex, 2).value))
            Exit Function
        End If
    Next rowIndex

    GetConfigValue = ""
End Function

Private Function FindHeaderColumn(ByVal ws As Worksheet, ByVal headerName As String) As Long
    Dim lastCol As Long
    Dim colIndex As Long
    Dim cellValue As String

    lastCol = ws.Cells(1, ws.Columns.count).End(xlToLeft).Column

    For colIndex = 1 To lastCol
        cellValue = Trim$(CStr(ws.Cells(1, colIndex).value))
        If StrComp(cellValue, headerName, vbTextCompare) = 0 Then
            FindHeaderColumn = colIndex
            Exit Function
        End If
    Next colIndex

    Err.Raise vbObjectError + 1001, , "ヘッダーが見つかりません: " & headerName
End Function

Private Function TryFindHeaderColumn(ByVal ws As Worksheet, ByVal headerName As String) As Long
    Dim lastCol As Long
    Dim colIndex As Long
    Dim cellValue As String

    lastCol = ws.Cells(1, ws.Columns.count).End(xlToLeft).Column

    For colIndex = 1 To lastCol
        cellValue = Trim$(CStr(ws.Cells(1, colIndex).value))
        If StrComp(cellValue, headerName, vbTextCompare) = 0 Then
            TryFindHeaderColumn = colIndex
            Exit Function
        End If
    Next colIndex

    TryFindHeaderColumn = 0
End Function

Private Function GetNextDataRow(ByVal ws As Worksheet) As Long
    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.count, 1).End(xlUp).Row

    If lastRow < 2 Then
        GetNextDataRow = 2
    Else
        GetNextDataRow = lastRow + 1
    End If
End Function

Private Function ResolveBookShort(ByVal bookId As String) As String
    Dim wsBooks As Worksheet
    Dim lastRow As Long
    Dim rowIndex As Long
    Dim colBookId As Long
    Dim colBookShort As Long

    On Error GoTo fallbackValue

    Set wsBooks = GetSheetByConfigOrName("booksSheetName", "Books")
    colBookId = FindHeaderColumn(wsBooks, "bookId")
    colBookShort = FindHeaderColumn(wsBooks, "bookShort")
    lastRow = wsBooks.Cells(wsBooks.Rows.count, colBookId).End(xlUp).Row

    For rowIndex = 2 To lastRow
        If StrComp(Trim$(CStr(wsBooks.Cells(rowIndex, colBookId).value)), Trim$(bookId), vbTextCompare) = 0 Then
            ResolveBookShort = Trim$(CStr(wsBooks.Cells(rowIndex, colBookShort).value))
            If Len(ResolveBookShort) = 0 Then GoTo fallbackValue
            Exit Function
        End If
    Next rowIndex

fallbackValue:
    ResolveBookShort = BuildFallbackBookShort(bookId)
End Function

Private Function BuildFallbackBookShort(ByVal bookId As String) As String
    Dim parts() As String

    parts = Split(LCase$(Trim$(bookId)), "-")

    If UBound(parts) >= 0 Then
        BuildFallbackBookShort = parts(0)
    Else
        BuildFallbackBookShort = "book"
    End If
End Function

