VERSION 5.00
Begin {C62A69F0-16DC-11CE-9E98-00AA00574A4F} frmTestEditor 
   Caption         =   "Test"
   ClientHeight    =   10305
   ClientLeft      =   120
   ClientTop       =   465
   ClientWidth     =   9375.001
   OleObjectBlob   =   "frmTestEditor.frx":0000
   StartUpPosition =   1  'オーナー フォームの中央
End
Attribute VB_Name = "frmTestEditor"
Attribute VB_GlobalNameSpace = False
Attribute VB_Creatable = False
Attribute VB_PredeclaredId = True
Attribute VB_Exposed = False
Option Explicit

Private Sub UserForm_Initialize()
    SetupComboBoxes
    SetDefaultValues
    ApplyUiSettings
    RefreshTestPreview
End Sub

Private Sub SetupComboBoxes()
    With cmbMode
        .Clear
        .AddItem "practice"
        .AddItem "test"
        .ListIndex = 1
    End With
End Sub

Private Sub SetDefaultValues()
    Dim activeBookId As String

    On Error Resume Next
    activeBookId = GetConfigValue("activeBookId")
    On Error GoTo 0

    txtBookId.text = activeBookId
    txtTestNo.text = ""
    txtTestIdPreview.text = ""
    txtTestTitle.text = ""
    txtTargetLessonFrom.text = ""
    txtTargetLessonTo.text = ""
    txtPublishedAt.text = Format$(Date, "yyyy-mm-dd")
    txtNotes.text = ""
    txtTimeLimitMinutes.text = ""
End Sub

Private Sub ApplyUiSettings()
    Me.Caption = "テストエディタ"

    txtTestIdPreview.Locked = True
    txtTestIdPreview.BackColor = RGB(240, 240, 240)
    txtTestIdPreview.Multiline = True
    txtTestIdPreview.EnterKeyBehavior = True
    txtTestIdPreview.WordWrap = True
    On Error Resume Next
    txtTestIdPreview.ScrollBars = fmScrollBarsVertical
    On Error GoTo 0

    txtNotes.Multiline = True
    txtNotes.EnterKeyBehavior = True
    txtNotes.WordWrap = True
    On Error Resume Next
    txtNotes.ScrollBars = fmScrollBarsVertical
    On Error GoTo 0
End Sub

Private Sub btnPreviewId_Click()
    RefreshTestPreview
End Sub

Private Sub btnSave_Click()
    On Error GoTo ErrHandler

    Dim wsTests As Worksheet
    Dim nextRow As Long

    Dim colTestId As Long
    Dim colBookId As Long
    Dim colTestTitle As Long
    Dim colTargetLessonFrom As Long
    Dim colTargetLessonTo As Long
    Dim colMode As Long
    Dim colPublishedAt As Long
    Dim colNotes As Long
    Dim colTimeLimitMinutes As Long

    Dim bookId As String
    Dim bookShort As String
    Dim testNo As Long
    Dim testId As String

    bookId = Trim$(txtBookId.text)

    If Len(bookId) = 0 Then
        MsgBox "教材IDを入力してください。", vbExclamation
        Exit Sub
    End If

    If Len(Trim$(txtTestNo.text)) = 0 Or Not IsNumeric(txtTestNo.text) Then
        MsgBox "テスト番号は数値で入力してください。", vbExclamation
        Exit Sub
    End If

    If Len(Trim$(txtTestTitle.text)) = 0 Then
        MsgBox "テストタイトルを入力してください。", vbExclamation
        Exit Sub
    End If

    If Len(Trim$(txtTargetLessonFrom.text)) > 0 And Not IsNumeric(txtTargetLessonFrom.text) Then
        MsgBox "対象レッスン開始は数値で入力してください。", vbExclamation
        Exit Sub
    End If

    If Len(Trim$(txtTargetLessonTo.text)) > 0 And Not IsNumeric(txtTargetLessonTo.text) Then
        MsgBox "対象レッスン終了は数値で入力してください。", vbExclamation
        Exit Sub
    End If

    If Len(Trim$(txtTargetLessonFrom.text)) > 0 And Len(Trim$(txtTargetLessonTo.text)) > 0 Then
        If CLng(Val(txtTargetLessonFrom.text)) > CLng(Val(txtTargetLessonTo.text)) Then
            MsgBox "対象レッスン開始は対象レッスン終了以下にしてください。", vbExclamation
            Exit Sub
        End If
    End If

    If Len(Trim$(txtTimeLimitMinutes.text)) > 0 Then
        If Not IsNumeric(txtTimeLimitMinutes.text) Then
            MsgBox "制限時間（分）は数値で入力してください。", vbExclamation
            Exit Sub
        End If

        If CLng(Val(txtTimeLimitMinutes.text)) <= 0 Then
            MsgBox "制限時間（分）は 1 以上の数値を入力してください。空欄なら時間制限なしになります。", vbExclamation
            Exit Sub
        End If
    End If

    Set wsTests = GetSheetByConfigOrName("testsSheetName", "Tests")

    colTestId = FindHeaderColumn(wsTests, "testId")
    colBookId = FindHeaderColumn(wsTests, "bookId")
    colTestTitle = FindHeaderColumn(wsTests, "testTitle")
    colTargetLessonFrom = FindHeaderColumn(wsTests, "targetLessonFrom")
    colTargetLessonTo = FindHeaderColumn(wsTests, "targetLessonTo")
    colMode = FindHeaderColumn(wsTests, "mode")
    colPublishedAt = FindHeaderColumn(wsTests, "publishedAt")
    colNotes = FindHeaderColumn(wsTests, "notes")
    colTimeLimitMinutes = FindHeaderColumn(wsTests, "timeLimitMinutes")

    testNo = CLng(Val(txtTestNo.text))
    bookShort = ResolveBookShort(bookId)
    testId = BuildTestId(bookShort, testNo)

    If TestIdAlreadyExists(wsTests, colTestId, colBookId, testId, bookId) Then
        If MsgBox("同じ testId が既に存在します。" & vbCrLf & _
                  testId & vbCrLf & vbCrLf & _
                  "そのまま追加しますか？", vbQuestion + vbYesNo) <> vbYes Then
            Exit Sub
        End If
    End If

    nextRow = GetNextDataRow(wsTests)

    wsTests.Cells(nextRow, colTestId).value = testId
    wsTests.Cells(nextRow, colBookId).value = bookId
    wsTests.Cells(nextRow, colTestTitle).value = Trim$(txtTestTitle.text)

    If Len(Trim$(txtTargetLessonFrom.text)) > 0 Then
        wsTests.Cells(nextRow, colTargetLessonFrom).value = CLng(Val(txtTargetLessonFrom.text))
    Else
        wsTests.Cells(nextRow, colTargetLessonFrom).value = ""
    End If

    If Len(Trim$(txtTargetLessonTo.text)) > 0 Then
        wsTests.Cells(nextRow, colTargetLessonTo).value = CLng(Val(txtTargetLessonTo.text))
    Else
        wsTests.Cells(nextRow, colTargetLessonTo).value = ""
    End If

    wsTests.Cells(nextRow, colMode).value = Trim$(cmbMode.value)
    wsTests.Cells(nextRow, colPublishedAt).value = Trim$(txtPublishedAt.text)
    wsTests.Cells(nextRow, colNotes).value = Trim$(txtNotes.text)

    If Len(Trim$(txtTimeLimitMinutes.text)) > 0 Then
        wsTests.Cells(nextRow, colTimeLimitMinutes).value = CLng(Val(txtTimeLimitMinutes.text))
    Else
        wsTests.Cells(nextRow, colTimeLimitMinutes).value = ""
    End If

    RefreshTestPreview

    MsgBox "Tests シートに保存しました。" & vbCrLf & testId, vbInformation

    ClearForNextEntry
    Exit Sub

ErrHandler:
    MsgBox "保存時にエラーが発生しました。" & vbCrLf & Err.description, vbCritical
End Sub

Private Sub btnClose_Click()
    Unload Me
End Sub

Private Sub txtBookId_AfterUpdate()
    RefreshTestPreview
End Sub

Private Sub txtTestNo_AfterUpdate()
    RefreshTestPreview
End Sub

Private Sub txtTargetLessonFrom_AfterUpdate()
    RefreshTestPreview
End Sub

Private Sub txtTargetLessonTo_AfterUpdate()
    RefreshTestPreview
End Sub

Private Sub txtTimeLimitMinutes_AfterUpdate()
    RefreshTestPreview
End Sub

Private Sub txtBookId_Change()
    RefreshTestPreview
End Sub

Private Sub txtTestNo_Change()
    RefreshTestPreview
End Sub

Private Sub txtTargetLessonFrom_Change()
    RefreshTestPreview
End Sub

Private Sub txtTargetLessonTo_Change()
    RefreshTestPreview
End Sub

Private Sub txtTimeLimitMinutes_Change()
    RefreshTestPreview
End Sub

Private Sub RefreshTestPreview()
    On Error GoTo SafeExit

    Dim bookId As String
    Dim bookShort As String
    Dim testNo As Long
    Dim testId As String
    Dim previewText As String

    bookId = Trim$(txtBookId.text)

    If Len(bookId) = 0 Then
        txtTestIdPreview.text = ""
        Exit Sub
    End If

    If Len(Trim$(txtTestNo.text)) = 0 Or Not IsNumeric(txtTestNo.text) Then
        txtTestIdPreview.text = ""
        Exit Sub
    End If

    bookShort = ResolveBookShort(bookId)
    testNo = CLng(Val(txtTestNo.text))
    testId = BuildTestId(bookShort, testNo)

    previewText = testId & vbCrLf & BuildTestPreviewDetail(bookId, testId)

    If Len(Trim$(txtTimeLimitMinutes.text)) > 0 Then
        previewText = previewText & vbCrLf & "制限時間: " & Trim$(txtTimeLimitMinutes.text) & "分"
    Else
        previewText = previewText & vbCrLf & "制限時間: なし"
    End If

    txtTestIdPreview.text = previewText

SafeExit:
End Sub

Private Function BuildTestPreviewDetail(ByVal bookId As String, ByVal testId As String) As String
    On Error GoTo NotFound

    Dim wsTests As Worksheet
    Dim lastRow As Long
    Dim rowIndex As Long

    Dim colBookId As Long
    Dim colTestId As Long
    Dim colTestTitle As Long
    Dim colTargetLessonFrom As Long
    Dim colTargetLessonTo As Long
    Dim colMode As Long
    Dim colTimeLimitMinutes As Long

    Dim testTitle As String
    Dim fromText As String
    Dim toText As String
    Dim modeText As String
    Dim timeLimitText As String
    Dim detailText As String

    Set wsTests = GetSheetByConfigOrName("testsSheetName", "Tests")

    colBookId = FindHeaderColumn(wsTests, "bookId")
    colTestId = FindHeaderColumn(wsTests, "testId")
    colTestTitle = FindHeaderColumn(wsTests, "testTitle")
    colTargetLessonFrom = FindHeaderColumn(wsTests, "targetLessonFrom")
    colTargetLessonTo = FindHeaderColumn(wsTests, "targetLessonTo")
    colMode = FindHeaderColumn(wsTests, "mode")
    colTimeLimitMinutes = FindHeaderColumn(wsTests, "timeLimitMinutes")

    lastRow = wsTests.Cells(wsTests.Rows.count, colTestId).End(xlUp).Row

    For rowIndex = 2 To lastRow
        If StrComp(Trim$(CStr(wsTests.Cells(rowIndex, colBookId).value)), Trim$(bookId), vbTextCompare) = 0 _
           And StrComp(Trim$(CStr(wsTests.Cells(rowIndex, colTestId).value)), Trim$(testId), vbTextCompare) = 0 Then

            testTitle = Trim$(CStr(wsTests.Cells(rowIndex, colTestTitle).value))
            fromText = Trim$(CStr(wsTests.Cells(rowIndex, colTargetLessonFrom).value))
            toText = Trim$(CStr(wsTests.Cells(rowIndex, colTargetLessonTo).value))
            modeText = Trim$(CStr(wsTests.Cells(rowIndex, colMode).value))
            timeLimitText = Trim$(CStr(wsTests.Cells(rowIndex, colTimeLimitMinutes).value))

            detailText = ""

            If Len(testTitle) > 0 Then
                detailText = testTitle
            End If

            If Len(fromText) > 0 Or Len(toText) > 0 Then
                If Len(detailText) > 0 Then detailText = detailText & vbCrLf
                detailText = detailText & "対象レッスン: " & fromText & " - " & toText
            End If

            If Len(modeText) > 0 Then
                If Len(detailText) > 0 Then detailText = detailText & vbCrLf
                detailText = detailText & "モード: " & modeText
            End If

            If Len(timeLimitText) > 0 Then
                If Len(detailText) > 0 Then detailText = detailText & vbCrLf
                detailText = detailText & "制限時間: " & timeLimitText & "分"
            End If

            If Len(detailText) = 0 Then
                detailText = "Tests シートに登録済み"
            End If

            BuildTestPreviewDetail = detailText
            Exit Function
        End If
    Next rowIndex

NotFound:
    BuildTestPreviewDetail = "※ Tests シートに未登録"
End Function

Private Sub ClearForNextEntry()
    txtTestNo.text = ""
    txtTestIdPreview.text = ""
    txtTestTitle.text = ""
    txtTargetLessonFrom.text = ""
    txtTargetLessonTo.text = ""
    If cmbMode.ListCount > 1 Then
        cmbMode.ListIndex = 1
    ElseIf cmbMode.ListCount > 0 Then
        cmbMode.ListIndex = 0
    End If
    txtPublishedAt.text = Format$(Date, "yyyy-mm-dd")
    txtNotes.text = ""
    txtTimeLimitMinutes.text = ""
End Sub

Private Function TestIdAlreadyExists( _
    ByVal wsTests As Worksheet, _
    ByVal testIdCol As Long, _
    ByVal bookIdCol As Long, _
    ByVal testId As String, _
    ByVal bookId As String _
) As Boolean
    Dim lastRow As Long
    Dim rowIndex As Long

    lastRow = wsTests.Cells(wsTests.Rows.count, testIdCol).End(xlUp).Row

    For rowIndex = 2 To lastRow
        If StrComp(Trim$(CStr(wsTests.Cells(rowIndex, testIdCol).value)), Trim$(testId), vbTextCompare) = 0 _
           And StrComp(Trim$(CStr(wsTests.Cells(rowIndex, bookIdCol).value)), Trim$(bookId), vbTextCompare) = 0 Then
            TestIdAlreadyExists = True
            Exit Function
        End If
    Next rowIndex

    TestIdAlreadyExists = False
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

