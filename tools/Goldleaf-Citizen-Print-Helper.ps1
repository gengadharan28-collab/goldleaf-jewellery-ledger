param([int]$Port = 17655)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
function Send-Response {
  param($Stream,[int]$Status=200,[string]$Body='{"ok":true}',[string]$Type='application/json')
  $reason=if($Status -eq 200){'OK'}else{'Error'};$bytes=[Text.Encoding]::UTF8.GetBytes($Body);$crlf=[string][char]13+[char]10
  $head="HTTP/1.1 $Status $reason${crlf}Content-Type: $Type; charset=utf-8${crlf}Content-Length: $($bytes.Length)${crlf}Access-Control-Allow-Origin: *${crlf}Access-Control-Allow-Methods: GET, POST, OPTIONS${crlf}Access-Control-Allow-Headers: Content-Type${crlf}Access-Control-Allow-Private-Network: true${crlf}Connection: close${crlf}${crlf}"
  $headBytes=[Text.Encoding]::ASCII.GetBytes($head);$Stream.Write($headBytes,0,$headBytes.Length);if($bytes.Length){$Stream.Write($bytes,0,$bytes.Length)};$Stream.Flush()
}
function Find-HeaderEnd([byte[]]$Data,[int]$Count){for($i=0;$i -le $Count-4;$i++){if($Data[$i]-eq 13-and$Data[$i+1]-eq 10-and$Data[$i+2]-eq 13-and$Data[$i+3]-eq 10){return $i}};return -1}
function Print-Receipt($Payload){
  $printer=[string]$Payload.printer;if([string]::IsNullOrWhiteSpace($printer)){$printer='CITIZEN CT-D150'}
  $encoded=[string]$Payload.imageDataUrl;if($encoded -notmatch '^data:image/png;base64,'){throw 'Invalid receipt image'}
  $raw=[Convert]::FromBase64String(($encoded-replace'^data:image/png;base64,',''));$ms=New-Object IO.MemoryStream(,$raw);$image=[Drawing.Image]::FromStream($ms)
  try{
    $widthMm=if($Payload.widthMm){[double]$Payload.widthMm}else{64.0};$heightMm=[Math]::Max(18.0,($image.Height/[double]$image.Width)*$widthMm)
    $w=[Math]::Max(1,[int][Math]::Ceiling($widthMm/25.4*100));$h=[Math]::Max(1,[int][Math]::Ceiling($heightMm/25.4*100));$doc=New-Object Drawing.Printing.PrintDocument
    try{
      $doc.PrinterSettings.PrinterName=$printer;if(-not $doc.PrinterSettings.IsValid){throw "Printer not found: $printer"}
      $doc.DefaultPageSettings.PaperSize=New-Object Drawing.Printing.PaperSize('Goldleaf Exact Receipt',$w,$h);$doc.DefaultPageSettings.Margins=New-Object Drawing.Printing.Margins(0,0,0,0)
      $doc.OriginAtMargins=$false;$doc.PrintController=New-Object Drawing.Printing.StandardPrintController
      $handler={param($sender,$e);$e.Graphics.PageUnit=[Drawing.GraphicsUnit]::Display;$e.Graphics.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic;$e.Graphics.PixelOffsetMode=[Drawing.Drawing2D.PixelOffsetMode]::HighQuality;$e.Graphics.DrawImage($image,(New-Object Drawing.RectangleF(0,0,$w,$h)));$e.HasMorePages=$false}
      $doc.add_PrintPage($handler);try{$doc.Print()}finally{$doc.remove_PrintPage($handler)}
    }finally{$doc.Dispose()}
    return @{ok=$true;printer=$printer;widthMm=$widthMm;heightMm=[Math]::Round($heightMm,1)}
  }finally{$image.Dispose();$ms.Dispose()}
}
$listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,$Port);$listener.Start();Write-Host "Goldleaf Citizen print helper ready on 127.0.0.1:$Port"
try{while($true){
  $client=$listener.AcceptTcpClient()
  try{
    $stream=$client.GetStream();$buffer=New-Object byte[] 65536;$data=New-Object byte[] 0;$headerEnd=-1
    while($headerEnd-lt 0){$n=$stream.Read($buffer,0,$buffer.Length);if($n-le 0){break};$old=$data.Length;[Array]::Resize([ref]$data,$old+$n);[Array]::Copy($buffer,0,$data,$old,$n);$headerEnd=Find-HeaderEnd $data $data.Length;if($data.Length-gt 1048576){throw 'Request headers too large'}}
    if($headerEnd-lt 0){continue};$header=[Text.Encoding]::ASCII.GetString($data,0,$headerEnd);$first=($header-split'\r\n')[0];$parts=$first-split' ';$method=$parts[0];$path=$parts[1];$contentLength=0
    if($header-match'(?im)^Content-Length:\s*(\d+)'){$contentLength=[int]$Matches[1]};$bodyStart=$headerEnd+4
    while(($data.Length-$bodyStart)-lt$contentLength){$n=$stream.Read($buffer,0,$buffer.Length);if($n-le 0){break};$old=$data.Length;[Array]::Resize([ref]$data,$old+$n);[Array]::Copy($buffer,0,$data,$old,$n)}
    if($method-eq'OPTIONS'){Send-Response $stream;continue};if($method-eq'GET'-and$path-eq'/health'){Send-Response $stream 200 '{"ok":true,"service":"Goldleaf Citizen Print"}';continue}
    if($method-eq'POST'-and$path-eq'/print-form'){
      $body=[Text.Encoding]::UTF8.GetString($data,$bodyStart,$contentLength);$fields=@{}
      foreach($pair in ($body-split'&')){$kv=$pair-split'=',2;if($kv.Count-eq 2){$fields[[Net.WebUtility]::UrlDecode($kv[0])]=[Net.WebUtility]::UrlDecode($kv[1])}}
      $payload=[PSCustomObject]@{printer=$fields.printer;imageDataUrl=$fields.imageDataUrl;widthMm=$fields.widthMm;cut=$fields.cut};$result=Print-Receipt $payload
      Send-Response $stream 200 '<!doctype html><title>Goldleaf Print</title><body style="font:14px Segoe UI;padding:20px">Receipt sent to Citizen printer.<script>setTimeout(()=>window.close(),350)</script></body>' 'text/html';continue
    }
    if($method-eq'POST'-and$path-eq'/print'){$json=[Text.Encoding]::UTF8.GetString($data,$bodyStart,$contentLength);$payload=$json|ConvertFrom-Json;$result=Print-Receipt $payload;Send-Response $stream 200 ($result|ConvertTo-Json -Compress);continue}
    Send-Response $stream 404 '{"ok":false,"error":"Not found"}'
  }catch{try{Send-Response $stream 500 ((@{ok=$false;error=$_.Exception.Message}|ConvertTo-Json -Compress))}catch{}}finally{$client.Close()}
}}finally{$listener.Stop()}
