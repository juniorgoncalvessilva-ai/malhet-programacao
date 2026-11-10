Attribute VB_Name = "Programacao"
' ======================================================================================
' PROGRAMAÇÃO v5 — reorganizar, sequenciar, atualizar e emitir (módulo único)
'   ReorganizarTudo      limpa a MONTAR e refaz as abas de programação
'   SequenciarEquipes    ordena as atividades de cada equipe respeitando as predecessoras
'   AtualizarProgramacao recalcula e refaz as abas EMITIDA
'   EmitirSemanal        cópia só com valores da semanal, P/R mesclado até a Unid
'   EmitirMensal         idem para a mensal
' ======================================================================================
Option Explicit

Const N_LINHAS As Long = 150
Const N_SLOTS As Long = 600
Const LIN_M As Long = 5
Const CAB_M As Long = 4

Sub ReorganizarTudo()
    Dim calc As Long, rel As String
    calc = Application.Calculation
    Application.ScreenUpdating = False
    Application.EnableEvents = False
    Application.Calculation = xlCalculationManual
    rel = ReorganizarMontar()
    If Left(rel, 4) <> "ERRO" Then
        rel = rel & vbLf & RefazerFormato("Programação Semanal", 12, "BO")
        rel = rel & vbLf & RefazerFormato("Programação Mensal", 6, "BE")
    End If
    Application.Calculation = calc
    Application.EnableEvents = True
    Application.ScreenUpdating = True
    If Left(rel, 4) = "ERRO" Then MsgBox rel, vbExclamation: Exit Sub
    AtualizarProgramacao False
    MsgBox "Reorganização feita:" & vbLf & rel, vbInformation
End Sub

Private Function EhEntrada(ByVal nome As String) As Boolean
    Dim lista, x
    nome = Trim(nome)
    lista = Array("LOCAL (manual", "ÁREA", "ATIVIDADE", "Item PQ (manual)", "Complemento (manual)", _
                  "P/O/E", "Responsável", "Encarregado", "Téc. Segurança", "RAC", "PTS", "ART", "PTO", "ATA", _
                  "Qtd projeto (manual)", "Realizado (manual)", "Índice específico", _
                  "Recurso que governa (manual", "Índice AJUSTADO (manual)", "Seletor", "Equipe programada (manual)", _
                  "Base do cálculo", "Equipe da frente", "Sequência na equipe", _
                  "Pred. 1 (Nº)", "Tipo 1", "Lag 1 (dias)", "Pred. 2 (Nº)", "Tipo 2", "Lag 2 (dias)")
    For Each x In lista
        If nome = x Or nome Like x & " *" Then EhEntrada = True: Exit Function
    Next x
    EhEntrada = (nome Like "Real D#" Or nome Like "Real D##")
End Function

Private Function ReorganizarMontar() As String
    Dim m As Worksheet, ultCol As Long, ultLin As Long, c As Long, r As Long, i As Long, k As Long
    Dim fim As Long, h As String, ent() As Long, nEnt As Long
    Dim cArea As Long, cAtiv As Long, cPQ As Long, cComp As Long, cLoc As Long, cNum As Long
    Dim dados(), nOk As Long, chave As String, vistos As Object
    Dim repetidas As Long, incompletas As Long, restauradas As Long, fx As String, achou As Range
    Dim novoNo As Object, iP1 As Long, iP2 As Long, velho As Variant

    Set m = ThisWorkbook.Worksheets("MONTAR")
    fim = LIN_M + N_LINHAS - 1
    ultCol = m.Cells(CAB_M, m.Columns.Count).End(xlToLeft).Column
    Set achou = m.Cells.Find("*", SearchOrder:=xlByRows, SearchDirection:=xlPrevious)
    If achou Is Nothing Then ultLin = fim Else ultLin = achou.Row
    If ultLin < fim Then ultLin = fim

    ReDim ent(1 To ultCol)
    For c = 1 To ultCol
        h = Trim(CStr(m.Cells(CAB_M, c).Value))
        If EhEntrada(h) Then nEnt = nEnt + 1: ent(nEnt) = c
        If h Like "ÁREA*" Then cArea = c
        If h Like "ATIVIDADE*" Then cAtiv = c
        If h Like "Item PQ (manual)*" Then cPQ = c
        If h = "Complemento (manual)" Then cComp = c
        If h Like "LOCAL (manual*" Then cLoc = c
    Next c
    cNum = 1
    If cAtiv = 0 Or cPQ = 0 Or cArea = 0 Then
        ReorganizarMontar = "ERRO: não achei as colunas ÁREA, ATIVIDADE e Item PQ (manual) na linha 4 da MONTAR."
        Exit Function
    End If

    Set vistos = CreateObject("Scripting.Dictionary")
    Set novoNo = CreateObject("Scripting.Dictionary")          ' Nº antigo -> Nº novo (as predecessoras seguem a linha)
    For i = 1 To nEnt
        If Trim(CStr(m.Cells(CAB_M, ent(i)).Value)) Like "Pred. 1*" Then iP1 = i
        If Trim(CStr(m.Cells(CAB_M, ent(i)).Value)) Like "Pred. 2*" Then iP2 = i
    Next i
    ReDim dados(1 To ultLin - LIN_M + 1, 1 To nEnt)
    For r = LIN_M To ultLin
        If Trim(m.Cells(r, cAtiv).Value & "") <> "" Or Trim(m.Cells(r, cPQ).Value & "") <> "" Then
            chave = m.Cells(r, cAtiv).Value & "|" & m.Cells(r, cPQ).Value & "|"
            If cComp > 0 Then chave = chave & m.Cells(r, cComp).Value
            If cLoc > 0 Then chave = chave & "|" & m.Cells(r, cLoc).Value
            velho = m.Cells(r, cNum).Value
            If vistos.Exists(chave) Then
                repetidas = repetidas + 1
                If Not novoNo.Exists(CStr(velho)) Then novoNo.Add CStr(velho), vistos(chave)
            Else
                nOk = nOk + 1
                vistos.Add chave, nOk
                If Not novoNo.Exists(CStr(velho)) Then novoNo.Add CStr(velho), nOk
                For i = 1 To nEnt
                    If m.Cells(r, ent(i)).HasFormula Then dados(nOk, i) = m.Cells(r, ent(i)).Formula Else dados(nOk, i) = m.Cells(r, ent(i)).Value
                Next i
            End If
        ElseIf Trim(m.Cells(r, cArea).Value & "") <> "" Then
            incompletas = incompletas + 1
        End If
    Next r
    If nOk > N_LINHAS Then
        ReorganizarMontar = "ERRO: há " & nOk & " atividades e a MONTAR comporta " & N_LINHAS & ". Apague algumas e rode de novo."
        Exit Function
    End If

    If ultLin > fim Then m.Rows(fim + 1 & ":" & ultLin).Delete

    For c = 1 To ultCol
        If c <> cNum And Not ColunaEhEntrada(c, ent, nEnt) Then
            fx = FormulaModa(m.Range(m.Cells(LIN_M, c), m.Cells(fim, c)))
            If fx <> "" Then
                restauradas = restauradas + ContarDiferentes(m.Range(m.Cells(LIN_M, c), m.Cells(fim, c)), fx)
                m.Range(m.Cells(LIN_M, c), m.Cells(fim, c)).FormulaR1C1 = fx
            End If
        End If
    Next c
    For r = LIN_M To fim
        m.Cells(r, cNum).Value = r - LIN_M + 1
    Next r

    For i = 1 To nEnt
        m.Range(m.Cells(LIN_M, ent(i)), m.Cells(fim, ent(i))).ClearContents
    Next i
    For k = 1 To nOk
        For i = 1 To nEnt
            If (i = iP1 Or i = iP2) And Not IsEmpty(dados(k, i)) Then
                If novoNo.Exists(CStr(dados(k, i))) Then dados(k, i) = novoNo(CStr(dados(k, i))) Else dados(k, i) = Empty
            End If
            If Not IsEmpty(dados(k, i)) Then m.Cells(LIN_M + k - 1, ent(i)).Formula = dados(k, i)
        Next i
    Next k

    m.Rows(LIN_M).Copy
    m.Rows(LIN_M + 1 & ":" & fim).PasteSpecial xlPasteFormats
    Application.CutCopyMode = False

    ReorganizarMontar = "- MONTAR: " & nOk & " atividades; " & repetidas & " repetida(s) e " & _
                        incompletas & " incompleta(s) removida(s); " & restauradas & " fórmula(s) restaurada(s)."
End Function

Private Function RefazerFormato(ByVal nomeAba As String, ByVal linIni As Long, ByVal colK As String) As String
    Dim ws As Worksheet, achou As Range, fim As Long, ultLin As Long, ultCol As Long
    Dim c As Long, r As Long, extras As Long, fx As String, seq()
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(nomeAba)
    On Error GoTo 0
    If ws Is Nothing Then RefazerFormato = "- " & nomeAba & ": aba não encontrada.": Exit Function
    fim = linIni + N_SLOTS - 1
    Set achou = ws.Cells.Find("*", SearchOrder:=xlByRows, SearchDirection:=xlPrevious)
    If achou Is Nothing Then ultLin = fim Else ultLin = achou.Row
    Set achou = ws.Cells.Find("*", SearchOrder:=xlByColumns, SearchDirection:=xlPrevious)
    If achou Is Nothing Then ultCol = 1 Else ultCol = achou.Column
    If ultLin > fim Then extras = ultLin - fim: ws.Rows(fim + 1 & ":" & ultLin).Delete
    For c = 1 To ultCol
        If c <> ws.Range(colK & "1").Column Then
            fx = FormulaModa(ws.Range(ws.Cells(linIni, c), ws.Cells(fim, c)))
            If fx <> "" Then ws.Range(ws.Cells(linIni, c), ws.Cells(fim, c)).FormulaR1C1 = fx
        End If
    Next c
    ReDim seq(1 To N_SLOTS, 1 To 1)
    For r = 1 To N_SLOTS: seq(r, 1) = r: Next r
    ws.Range(colK & linIni & ":" & colK & fim).Value = seq
    ws.Rows(linIni).Copy
    ws.Rows(linIni + 1 & ":" & fim).PasteSpecial xlPasteFormats
    Application.CutCopyMode = False
    ws.Rows(linIni + 1 & ":" & fim).RowHeight = ws.Rows(linIni).RowHeight
    RefazerFormato = "- " & nomeAba & ": " & N_SLOTS & " linhas refeitas" & _
                     IIf(extras > 0, "; " & extras & " linha(s) a mais apagada(s)", "") & "."
End Function

Private Function FormulaModa(rg As Range) As String
    Dim v, d As Object, i As Long, melhor As String, n As Long, f
    Set d = CreateObject("Scripting.Dictionary")
    v = rg.FormulaR1C1
    If Not IsArray(v) Then Exit Function
    For i = 1 To UBound(v, 1)
        If Left(CStr(v(i, 1)), 1) = "=" Then d(CStr(v(i, 1))) = d(CStr(v(i, 1))) + 1
    Next i
    For Each f In d.Keys
        If d(f) > n Then n = d(f): melhor = f
    Next f
    If n >= 3 Then FormulaModa = melhor
End Function

Private Function ContarDiferentes(rg As Range, ByVal fx As String) As Long
    Dim v, i As Long
    v = rg.FormulaR1C1
    For i = 1 To UBound(v, 1)
        If CStr(v(i, 1)) <> fx Then ContarDiferentes = ContarDiferentes + 1
    Next i
End Function

Private Function ColunaEhEntrada(ByVal c As Long, ent() As Long, ByVal nEnt As Long) As Boolean
    Dim i As Long
    For i = 1 To nEnt
        If ent(i) = c Then ColunaEhEntrada = True: Exit Function
    Next i
End Function


' ======================================================================================
' SEQUENCIAR EQUIPES: cada equipe faz uma atividade por vez; a ordem respeita as predecessoras
' (começa primeiro a que pode começar antes). Reescreve a "Sequência na equipe" das linhas
' com base CAPACIDADE e equipe. Rode depois de mudar predecessoras, equipes ou quantidades.
' ======================================================================================
Sub SequenciarEquipes()
    Dim m As Worksheet, c As Long, ultCol As Long, h As String, r As Long, i As Long, k As Long, n As Long
    Dim cOk As Long, cEq As Long, cBase As Long, cDur As Long, cSeq As Long, cCap As Long, cRest As Long
    Dim cP(1 To 2) As Long, cT(1 To 2) As Long, cL(1 To 2) As Long
    Dim fm As Double, ok() As Boolean, eq() As String, dur() As Double, pp() As Long, pt() As String, pl() As Double
    Dim S() As Double, E() As Double, feito() As Boolean, seq() As Long, pend As Long
    Dim livre As Object, cont As Object, melhor As Long, mIni As Double, mEs As Double, es As Double, ini As Double, pode As Boolean, v

    Application.ScreenUpdating = False
    Application.Calculate
    Set m = ThisWorkbook.Worksheets("MONTAR")
    fm = Val(ThisWorkbook.Worksheets("PARAMETROS").Range("B33").Value): If fm <= 0 Then fm = 1
    ultCol = m.Cells(CAB_M, m.Columns.Count).End(xlToLeft).Column
    For c = 1 To ultCol
        h = Trim(CStr(m.Cells(CAB_M, c).Value))
        If h = "ok" Then cOk = c
        If h Like "Equipe da frente*" Then cEq = c
        If h = "Base usada" Then cBase = c
        If h = "Duração (dias de ref.)" Then cDur = c
        If h = "Sequência na equipe" Then cSeq = c
        If h = "Capacidade (un/dia de referência)" Then cCap = c
        If h = "Restante" Then cRest = c
        For k = 1 To 2
            If h Like "Pred. " & k & "*" Then cP(k) = c
            If h Like "Tipo " & k & "*" Then cT(k) = c
            If h Like "Lag " & k & "*" Then cL(k) = c
        Next k
    Next c
    If cOk * cEq * cDur * cSeq * cP(1) * cP(2) = 0 Then MsgBox "MONTAR sem as colunas da sequência (use a v5).", vbExclamation: Exit Sub

    n = N_LINHAS
    ReDim ok(1 To n): ReDim eq(1 To n): ReDim dur(1 To n): ReDim pp(1 To n, 1 To 2): ReDim pt(1 To n, 1 To 2): ReDim pl(1 To n, 1 To 2)
    ReDim S(1 To n): ReDim E(1 To n): ReDim feito(1 To n): ReDim seq(1 To n)
    For i = 1 To n
        r = LIN_M + i - 1
        ok(i) = (m.Cells(r, cOk).Value = 1)
        If ok(i) Then
            If m.Cells(r, cBase).Value = "CAPACIDADE" Then eq(i) = CStr(m.Cells(r, cEq).Value)
            v = m.Cells(r, cDur).Value
            If IsNumeric(v) And Not IsError(v) Then
                dur(i) = CDbl(v)
            ElseIf Not IsError(m.Cells(r, cCap).Value) And Not IsError(m.Cells(r, cRest).Value) Then
                If Val(m.Cells(r, cCap).Value & "") > 0 Then dur(i) = Val(m.Cells(r, cRest).Value & "") / Val(m.Cells(r, cCap).Value & "")
            End If
            For k = 1 To 2
                v = m.Cells(r, cP(k)).Value
                If IsNumeric(v) And Not IsEmpty(v) Then
                    If CLng(v) >= 1 And CLng(v) <= n And CLng(v) <> i Then
                        pp(i, k) = CLng(v)
                        pt(i, k) = UCase(Trim(m.Cells(r, cT(k)).Value & ""))
                        pl(i, k) = Val(m.Cells(r, cL(k)).Value & "") * fm
                    End If
                End If
            Next k
        Else
            feito(i) = True
        End If
    Next i
    For i = 1 To n                                  ' predecessora que aponta para linha vazia é ignorada
        For k = 1 To 2
            If pp(i, k) > 0 Then If Not ok(pp(i, k)) Then pp(i, k) = 0
        Next k
        If Not feito(i) Then pend = pend + 1
    Next i

    Set livre = CreateObject("Scripting.Dictionary"): Set cont = CreateObject("Scripting.Dictionary")
    Do While pend > 0
        melhor = 0
        For i = 1 To n
            If Not feito(i) Then
                pode = True: es = 0
                For k = 1 To 2
                    If pp(i, k) > 0 Then
                        If Not feito(pp(i, k)) Then
                            pode = False
                        ElseIf pt(i, k) = "II" Then
                            If S(pp(i, k)) + pl(i, k) > es Then es = S(pp(i, k)) + pl(i, k)
                        Else
                            If E(pp(i, k)) + pl(i, k) > es Then es = E(pp(i, k)) + pl(i, k)
                        End If
                    End If
                Next k
                If pode Then
                    ini = es
                    If eq(i) <> "" Then If livre.Exists(eq(i)) Then If livre(eq(i)) > ini Then ini = livre(eq(i))
                    If melhor = 0 Or ini < mIni - 0.000001 Or (Abs(ini - mIni) <= 0.000001 And es < mEs) Then
                        melhor = i: mIni = ini: mEs = es
                    End If
                End If
            End If
        Next i
        If melhor = 0 Then                          ' predecessoras em ciclo: o resto fica na ordem da MONTAR
            MsgBox "Há predecessoras em ciclo (uma depende da outra). As linhas que sobraram ficaram na ordem da MONTAR.", vbExclamation
            For i = 1 To n
                If Not feito(i) Then feito(i) = True: If eq(i) <> "" Then cont(eq(i)) = cont(eq(i)) + 1: seq(i) = cont(eq(i))
            Next i
            Exit Do
        End If
        S(melhor) = mIni: E(melhor) = mIni + dur(melhor): feito(melhor) = True: pend = pend - 1
        If eq(melhor) <> "" Then
            livre(eq(melhor)) = E(melhor)
            cont(eq(melhor)) = cont(eq(melhor)) + 1
            seq(melhor) = cont(eq(melhor))
        End If
    Loop

    For i = 1 To n
        If ok(i) And eq(i) <> "" Then m.Cells(LIN_M + i - 1, cSeq).Value = seq(i)
    Next i
    Application.CalculateFullRebuild
    Application.ScreenUpdating = True
    MsgBox "Sequência das equipes refeita (" & cont.Count & " equipe(s)).", vbInformation
End Sub

Sub AtualizarProgramacao(Optional ByVal avisar As Boolean = True)
    Dim t As Single, m As Worksheet, msg As String, n As Long, temSem As Boolean, temMen As Boolean
    t = Timer
    Application.ScreenUpdating = False
    Application.Calculation = xlCalculationAutomatic
    Application.CalculateFullRebuild
    Set m = ThisWorkbook.Worksheets("MONTAR")
    If Len(m.Range("A3").Value & "") > 0 Then msg = msg & vbLf & "- " & m.Range("A3").Value
    n = Application.WorksheetFunction.CountIf(m.Range("A5:ZZ154"), "SEM *")
    If n > 0 Then msg = msg & vbLf & "- " & n & " linha(s) sem quantidade, sem índice ou sem equipe (coluna Alerta)"
    n = Application.WorksheetFunction.CountIf(m.Range("A5:ZZ154"), "EQUIPE SEM *")
    If n > 0 Then msg = msg & vbLf & "- " & n & " linha(s) com equipe sem o recurso que governa"
    n = Application.WorksheetFunction.CountIf(m.Range("A5:ZZ154"), "ITEM DA PQ*")
    If n > 0 Then msg = msg & vbLf & "- " & n & " item(ns) da PQ não encontrado(s)"
    temSem = ApagarEmitidas("Programação Semanal")
    temMen = ApagarEmitidas("Programação Mensal")
    If temSem Then Emitir "Programação Semanal", 12, "AK", "G", "V", "J", False
    If temMen Then Emitir "Programação Mensal", 6, "R", "A", "J", "D", False
    m.Activate
    Application.ScreenUpdating = True
    If avisar Then
        MsgBox "Programação atualizada em " & Format(Timer - t, "0.0") & " s." & _
               IIf(temSem Or temMen, vbLf & "Abas EMITIDA refeitas.", "") & _
               IIf(msg <> "", vbLf & vbLf & "Atenção:" & msg, ""), vbInformation
    ElseIf msg <> "" Then
        MsgBox "Atenção:" & msg, vbExclamation
    End If
End Sub

Sub EmitirSemanal()
    Application.CalculateFullRebuild
    Emitir "Programação Semanal", 12, "AK", "G", "V", "J", True
End Sub

Sub EmitirMensal()
    Application.CalculateFullRebuild
    Emitir "Programação Mensal", 6, "R", "A", "J", "D", True
End Sub

Private Function ApagarEmitidas(ByVal nomeAba As String) As Boolean
    Dim i As Long
    Application.DisplayAlerts = False
    For i = ThisWorkbook.Worksheets.Count To 1 Step -1
        If ThisWorkbook.Worksheets(i).Name Like Left(nomeAba & " EMITIDA", 31) & "*" Then
            ThisWorkbook.Worksheets(i).Delete
            ApagarEmitidas = True
        End If
    Next i
    Application.DisplayAlerts = True
End Function

Private Sub Emitir(ByVal nomeAba As String, ByVal linIni As Long, ByVal colPR As String, ByVal colIni As String, _
                   ByVal colUnd As String, ByVal colTexto As String, ByVal avisar As Boolean)
    Dim wsO As Worksheet, ws As Worksheet, r As Long, c As Long, ult As Long, apagar As Range
    On Error Resume Next
    Set wsO = ThisWorkbook.Worksheets(nomeAba)
    On Error GoTo 0
    If wsO Is Nothing Then MsgBox "Aba '" & nomeAba & "' não encontrada.": Exit Sub
    Application.ScreenUpdating = False
    Application.DisplayAlerts = False
    wsO.Copy After:=wsO
    Set ws = ActiveSheet
    ws.Name = Left(nomeAba & " EMITIDA " & Format(Now, "dd-mm hhmm"), 31)
    ws.UsedRange.Value = ws.UsedRange.Value
    ult = ws.UsedRange.Row + ws.UsedRange.Rows.Count - 1
    For r = linIni To ult
        If Trim(ws.Range(colPR & r).Value & "") = "" And Trim(ws.Range(colTexto & r).Value & "") = "" Then
            If apagar Is Nothing Then Set apagar = ws.Rows(r) Else Set apagar = Union(apagar, ws.Rows(r))
        End If
    Next r
    If Not apagar Is Nothing Then apagar.Delete
    ult = ws.Cells(ws.Rows.Count, ws.Range(colPR & "1").Column).End(xlUp).Row
    For r = linIni To ult
        If UCase(Trim(ws.Range(colPR & r).Value)) = "P" And UCase(Trim(ws.Range(colPR & r + 1).Value)) = "R" Then
            For c = ws.Range(colIni & "1").Column To ws.Range(colUnd & "1").Column
                With ws.Range(ws.Cells(r, c), ws.Cells(r + 1, c))
                    .Merge
                    .HorizontalAlignment = xlCenter
                    .VerticalAlignment = xlCenter
                    .WrapText = True
                End With
            Next c
            r = r + 1
        End If
    Next r
    Application.DisplayAlerts = True
    Application.ScreenUpdating = True
    If avisar Then MsgBox "Programação emitida na aba '" & ws.Name & "'."
End Sub
