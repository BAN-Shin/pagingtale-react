VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} frmQuestionEditor 
   Caption         =   "Question"
   ClientHeight    =   10305
   ClientLeft      =   120
   ClientTop       =   465
   ClientWidth     =   9375.001
   OleObjectBlob   =   "frmQuestionEditor.frx":0000
   StartUpPosition =   1  'オーナー フォームの中央
End
Attribute VB_Name = "frmQuestionEditor"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Explicit

Private Sub UserForm_Initialize()
    SetupComboBoxes
    SetDefaultValues
    ApplyUiSettings
    RefreshCalculatedFields
End Sub

Private Sub SetupComboBoxes()
    With cmbJudgeMode
        .Clear
        .AddItem "exact"
        .AddItem "includes"
        .AddItem "none"
        .ListIndex = 0
    End With

    With cmbMode
        .Clear
        .AddItem "practice"
        .AddItem "test"
        .ListIndex = 0
    End With
End Sub

Private Sub SetDefaultValues()
    Dim activeBookId As String

    On Error Resume Next
    activeBookId = GetConfigValue("activeBookId")
    On Error GoTo 0

    txtBookId.text = activeBookId
    txtLessonNo.text = ""
    txtLessonIdPreview.text = ""
    txtPage.text = ""
    txtDisplayOrder.text = ""
    txtQuestionId.text = ""
    txtPrompt.text = ""
    txtPlaceholder.text = ""
    txtCorrectAnswer.text = ""
    txtExplanation.text = ""
    txtPoints.text = "1"
    txtTags.text = ""
    chkIsPublished.value = True
End Sub

Private Sub ApplyUiSettings()
    Me.Caption = "問題エディタ"

    txtLessonIdPreview.Locked = True
    txtLessonIdPreview.BackColor = RGB(240, 240, 240)
    txtLessonIdPreview.Multiline = True
    txtLessonIdPreview.EnterKeyBehavior = True
    txtLessonIdPreview.WordWrap = True
    On Error Resume Next
    txtLessonIdPreview.ScrollBars = fmScrollBarsVertical
    On Error GoTo 0

    txtDisplayOrder.Locked = True
    txtDisplayOrder.BackColor = RGB(240, 240, 240)

    txtQuestionId.Locked = True
    txtQuestionId.BackColor = RGB(240, 240, 240)

    txtPrompt.Multiline = True
    txtPrompt.EnterKeyBehavior = True
    txtPrompt.WordWrap = True

    txtExplanation.Multiline = True
    txtExplanation.EnterKeyBehavior = True
    txtExplanation.WordWrap = True
End Sub

Private Sub btnPreviewId_Click()
    RefreshCalculatedFields
End Sub

Private Sub btnSave_Click()
    On Error GoTo ErrHandler

    Dim wsQuestions As Worksheet
    Dim nextRow As Long

    Dim colQuestionId As Long
    Dim colBookId As Long
    Dim colLessonId As Long
    Dim colPage As Long
    Dim colDisplayOrder As Long
    Dim colPrompt As Long
    Dim colPlaceholder As Long
    Dim colCorrectAnswer As Long
    Dim colJudgeMode As Long
    Dim colExplanation As Long
    Dim colPoints As Long
    Dim colMode As Long
    Dim colIsPublished As Long
    Dim colTags As Long

    Dim bookId As String
    Dim lessonNo As Long
    Dim lessonId As String
    Dim pageNo As Long
    Dim displayOrder As Long
    Dim questionId As String
    Dim bookShort As String

    bookId = Trim$(txtBookId.text)

    If Len(bookId) = 0 Then
        MsgBox "教材IDを入力してください。", vbExclamation
        Exit Sub
    End If

    If Len(Trim$(txtLessonNo.text)) = 0 Or Not IsNumeric(txtLessonNo.text) Then
        MsgBox "レッスン番号は数値で入力してください。", vbExclamation
        Exit Sub
    End If

    If Len(Trim$(txtPage.text)) = 0 Or Not IsNumeric(txtPage.text) Then
        MsgBox "ページ番号は数値で入力してください。", vbExclamation
        Exit Sub
    End If

    If Len(Trim$(txtPrompt.text)) = 0 Then
        MsgBox "問題文を入力してください。", vbExclamation
        Exit Sub
    End If

    If Len(Trim$(txtPoints.text)) = 0 Or Not IsNumeric(txtPoints.text) Then
        MsgBox "点数は数値で入力してください。", vbExclamation
        Exit Sub
    End If

    bookShort = ResolveBookShort(bookId)
    lessonNo = CLng(Val(txtLessonNo.text))
    lessonId = BuildLessonId(bookShort, lessonNo)
    pageNo = CLng(Val(txtPage.text))

    Set wsQuestions = GetSheetByConfigOrName("questionsSheetName", "Questions")

    colQuestionId = FindHeaderColumn(wsQuestions, "questionId")
    colBookId = FindHeaderColumn(wsQuestions, "bookId")
    colLessonId = FindHeaderColumn(wsQuestions, "lessonId")
    colPage = FindHeaderColumn(wsQuestions, "page")
    colDisplayOrder = FindHeaderColumn(wsQuestions, "displayOrder")
    colPrompt = FindHeaderColumn(wsQuestions, "prompt")
    colPlaceholder = FindHeaderColumn(wsQuestions, "placeholder")
    colCorrectAnswer = FindHeaderColumn(wsQuestions, "correctAnswer")
    colJudgeMode = FindHeaderColumn(wsQuestions, "judgeMode")
    colExplanation = FindHeaderColumn(wsQuestions, "explanation")
    colPoints = FindHeaderColumn(wsQuestions, "points")
    colMode = FindHeaderColumn(wsQuestions, "mode")
    colIsPublished = FindHeaderColumn(wsQuestions, "isPublished")
    colTags = FindHeaderColumn(wsQuestions, "tags")

    displayOrder = NextQuestionDisplayOrder( _
        wsQuestions, _
        colBookId, _
        colLessonId, _
        colPage, _
        colDisplayOrder, _
        bookId, _
        lessonId, _
        pageNo _
    )

    questionId = BuildQuestionId(bookShort, lessonNo, pageNo, displayOrder)

    nextRow = GetNextDataRow(wsQuestions)

    wsQuestions.Cells(nextRow, colQuestionId).value = questionId
    wsQuestions.Cells(nextRow, colBookId).value = bookId
    wsQuestions.Cells(nextRow, colLessonId).value = lessonId
    wsQuestions.Cells(nextRow, colPage).value = pageNo
    wsQuestions.Cells(nextRow, colDisplayOrder).value = displayOrder
    wsQuestions.Cells(nextRow, colPrompt).value = Trim$(txtPrompt.text)
    wsQuestions.Cells(nextRow, colPlaceholder).value = Trim$(txtPlaceholder.text)
    wsQuestions.Cells(nextRow, colCorrectAnswer).value = NormalizeCommaList(txtCorrectAnswer.text)
    wsQuestions.Cells(nextRow, colJudgeMode).value = Trim$(cmbJudgeMode.value)
    wsQuestions.Cells(nextRow, colExplanation).value = Trim$(txtExplanation.text)
    wsQuestions.Cells(nextRow, colPoints).value = CLng(Val(txtPoints.text))
    wsQuestions.Cells(nextRow, colMode).value = Trim$(cmbMode.value)
    wsQuestions.Cells(nextRow, colIsPublished).value = CBool(chkIsPublished.value)
    wsQuestions.Cells(nextRow, colTags).value = NormalizeCommaList(txtTags.text)

    txtDisplayOrder.text = CStr(displayOrder)
    txtQuestionId.text = questionId

    MsgBox "Questions シートに保存しました。" & vbCrLf & questionId, vbInformation

    ClearForNextEntry
    Exit Sub

ErrHandler:
    MsgBox "保存時にエラーが発生しました。" & vbCrLf & Err.description, vbCritical
End Sub

Private Sub btnClose_Click()
    Unload Me
End Sub

Private Sub txtBookId_AfterUpdate()
    UpdateLessonPreview
    RefreshCalculatedFields
End Sub

Private Sub txtLessonNo_AfterUpdate()
    UpdateLessonPreview
    RefreshCalculatedFields
End Sub

Private Sub txtPage_AfterUpdate()
    RefreshCalculatedFields
End Sub

Private Sub txtBookId_Change()
    RefreshCalculatedFields
End Sub

Private Sub txtLessonNo_Change()
    RefreshCalculatedFields
End Sub

Private Sub txtPage_Change()
    RefreshCalculatedFields
End Sub

Private Sub RefreshCalculatedFields()
    On Error GoTo SafeExit

    Dim wsQuestions As Worksheet
    Dim colBookId As Long
    Dim colLessonId As Long
    Dim colPage As Long
    Dim colDisplayOrder As Long

    Dim bookId As String
    Dim lessonNo As Long
    Dim lessonId As String
    Dim pageNo As Long
    Dim displayOrder As Long
    Dim questionId As String
    Dim bookShort As String

    bookId = Trim$(txtBookId.text)

    If Len(bookId) = 0 Then GoTo SafeExit
    If Len(Trim$(txtLessonNo.text)) = 0 Then GoTo SafeExit
    If Not IsNumeric(txtLessonNo.text) Then GoTo SafeExit
    If Len(Trim$(txtPage.text)) = 0 Then GoTo SafeExit
    If Not IsNumeric(txtPage.text) Then GoTo SafeExit

    bookShort = ResolveBookShort(bookId)
    lessonNo = CLng(Val(txtLessonNo.text))
    lessonId = BuildLessonId(bookShort, lessonNo)
    pageNo = CLng(Val(txtPage.text))

    Set wsQuestions = GetSheetByConfigOrName("questionsSheetName", "Questions")
    colBookId = FindHeaderColumn(wsQuestions, "bookId")
    colLessonId = FindHeaderColumn(wsQuestions, "lessonId")
    colPage = FindHeaderColumn(wsQuestions, "page")
    colDisplayOrder = FindHeaderColumn(wsQuestions, "displayOrder")

    displayOrder = NextQuestionDisplayOrder( _
        wsQuestions, _
        colBookId, _
        colLessonId, _
        colPage, _
        colDisplayOrder, _
        bookId, _
        lessonId, _
        pageNo _
    )

    questionId = BuildQuestionId(bookShort, lessonNo, pageNo, displayOrder)

    txtDisplayOrder.text = CStr(displayOrder)
    txtQuestionId.text = questionId

SafeExit:
End Sub

Private Sub UpdateLessonPreview()
    On Error GoTo SafeExit

    Dim bookId As String
    Dim lessonNo As Long
    Dim lessonId As String
    Dim bookShort As String
    Dim previewText As String

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
    Dim colLearningObjective As Long

    Dim lessonTitle As String
    Dim startPageText As String
    Dim endPageText As String
    Dim themeText As String
    Dim learningObjectiveText As String
    Dim detailText As String

    Set wsLessons = GetSheetByConfigOrName("lessonsSheetName", "Lessons")

    colBookId = FindHeaderColumn(wsLessons, "bookId")
    colLessonId = FindHeaderColumn(wsLessons, "lessonId")
    colLessonTitle = FindHeaderColumn(wsLessons, "lessonTitle")
    colStartPage = FindHeaderColumn(wsLessons, "startPage")
    colEndPage = FindHeaderColumn(wsLessons, "endPage")
    colTheme = TryFindHeaderColumn(wsLessons, "theme")
    colLearningObjective = TryFindHeaderColumn(wsLessons, "learningObjective")

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

            If colLearningObjective > 0 Then
                learningObjectiveText = Trim$(CStr(wsLessons.Cells(rowIndex, colLearningObjective).value))
            Else
                learningObjectiveText = ""
            End If

            detailText = ""

            If Len(lessonTitle) > 0 Then
                detailText = "タイトル: " & lessonTitle
            End If

            If Len(themeText) > 0 Then
                If Len(detailText) > 0 Then detailText = detailText & vbCrLf
                detailText = detailText & "テーマ: " & themeText
            End If

            If Len(startPageText) > 0 Or Len(endPageText) > 0 Then
                If Len(detailText) > 0 Then detailText = detailText & vbCrLf
                detailText = detailText & "ページ: " & startPageText & " - " & endPageText
            End If

            If Len(learningObjectiveText) > 0 Then
                If Len(detailText) > 0 Then detailText = detailText & vbCrLf
                detailText = detailText & "目標: " & TruncateText(learningObjectiveText, 60)
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
    txtPage.text = ""
    txtDisplayOrder.text = ""
    txtQuestionId.text = ""
    txtPrompt.text = ""
    txtPlaceholder.text = ""
    txtCorrectAnswer.text = ""
    txtExplanation.text = ""
    txtPoints.text = "1"
    txtTags.text = ""
    cmbJudgeMode.ListIndex = 0
    cmbMode.ListIndex = 0
    chkIsPublished.value = True
    UpdateLessonPreview
End Sub

Private Function NormalizeCommaList(ByVal value As String) As String
    Dim text As String
    Dim parts() As String
    Dim resultText As String
    Dim i As Long
    Dim partText As String

    text = Trim$(value)
    text = Replace(text, "，", ",")
    text = Replace(text, "、", ",")

    Do While InStr(text, ",,") > 0
        text = Replace(text, ",,", ",")
    Loop

    If Len(text) > 0 Then
        If Left$(text, 1) = "," Then text = Mid$(text, 2)
        If Len(text) > 0 Then
            If Right$(text, 1) = "," Then text = Left$(text, Len(text) - 1)
        End If
    End If

    If Len(text) = 0 Then
        NormalizeCommaList = ""
        Exit Function
    End If

    parts = Split(text, ",")

    For i = LBound(parts) To UBound(parts)
        partText = Trim$(parts(i))
        If Len(partText) > 0 Then
            If Len(resultText) > 0 Then resultText = resultText & ","
            resultText = resultText & partText
        End If
    Next i

    NormalizeCommaList = resultText
End Function

Private Function TruncateText(ByVal value As String, ByVal maxLength As Long) As String
    Dim text As String

    text = Trim$(value)

    If Len(text) <= maxLength Then
        TruncateText = text
    Else
        TruncateText = Left$(text, maxLength) & "..."
    End If
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

