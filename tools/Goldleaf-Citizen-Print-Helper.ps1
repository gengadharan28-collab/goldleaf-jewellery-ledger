param([int]$Port = 17655)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class GoldleafRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public class DOC_INFO_1 {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }
  [DllImport("winspool.drv", SetLastError=true, CharSet=CharSet.Unicode)]
  static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);
  [DllImport("winspool.drv", SetLastError=true)]
  static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError=true, CharSet=CharSet.Unicode)]
  static extern int StartDocPrinter(IntPtr hPrinter, int level, [In] DOC_INFO_1 di);
  [DllImport("winspool.drv", SetLastError=true)]
  static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError=true)]
  static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError=true)]
  static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError=true)]
  static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);
  public static void Send(string printer, byte[] data) {
    IntPtr h;
    if(!OpenPrinter(printer,out h,IntPtr.Zero)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
    try {
      var di=new DOC_INFO_1{pDocName="Goldleaf 80mm Receipt",pDataType="RAW"};
      if(StartDocPrinter(h,1,di)==0) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
      try {
        if(!StartPagePrinter(h)) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
        try {
          // USB receipt drivers can block indefinitely when a large raster is
          // handed to WritePrinter in one call.  Feed the spooler in modest
          // chunks so the CT-D150 can consume the job continuously.
          const int chunkSize = 16384;
          int offset = 0;
          while(offset < data.Length) {
            int count = Math.Min(chunkSize, data.Length - offset);
            byte[] chunk = new byte[count];
            Buffer.BlockCopy(data, offset, chunk, 0, count);
            int written;
            if(!WritePrinter(h,chunk,count,out written) || written<=0) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
            offset += written;
          }
        } finally { EndPagePrinter(h); }
      } finally { EndDocPrinter(h); }
    } finally { ClosePrinter(h); }
  }
}
"@
function Send-Response {
  param($Stream,[int]$Status=200,[string]$Body='{"ok":true}',[string]$Type='application/json')
  $reason=if($Status -eq 200){'OK'}else{'Error'};$bytes=[Text.Encoding]::UTF8.GetBytes($Body);$crlf=[string][char]13+[char]10
  $head="HTTP/1.1 $Status $reason${crlf}Content-Type: $Type; charset=utf-8${crlf}Content-Length: $($bytes.Length)${crlf}Access-Control-Allow-Origin: *${crlf}Access-Control-Allow-Methods: GET, POST, OPTIONS${crlf}Access-Control-Allow-Headers: Content-Type${crlf}Access-Control-Allow-Private-Network: true${crlf}Connection: close${crlf}${crlf}"
  $headBytes=[Text.Encoding]::ASCII.GetBytes($head);$Stream.Write($headBytes,0,$headBytes.Length);if($bytes.Length){$Stream.Write($bytes,0,$bytes.Length)};$Stream.Flush()
}
function Find-HeaderEnd([byte[]]$Data,[int]$Count){for($i=0;$i -le $Count-4;$i++){if($Data[$i]-eq 13-and$Data[$i+1]-eq 10-and$Data[$i+2]-eq 13-and$Data[$i+3]-eq 10){return $i}};return -1}
function Print-WithCitizenDriver($Printer,$Image){
  $doc=New-Object Drawing.Printing.PrintDocument
  try{
    $doc.PrinterSettings.PrinterName=$Printer
    if(-not $doc.PrinterSettings.IsValid){throw "Printer not available: $Printer"}
    $doc.PrintController=New-Object Drawing.Printing.StandardPrintController
    # PaperSize uses 1/100 inch. Keep the 68 mm raster centred on 80 mm
    # media and make the page only as tall as its actual receipt content.
    $paperWidth=315
    $imageWidth=268
    $imageHeight=[Math]::Max(1,[int][Math]::Ceiling($Image.Height*($imageWidth/[double]$Image.Width)))
    $paperHeight=$imageHeight+8
    $doc.DefaultPageSettings.PaperSize=New-Object Drawing.Printing.PaperSize('Goldleaf 80mm Receipt',$paperWidth,$paperHeight)
    $doc.DefaultPageSettings.Margins=New-Object Drawing.Printing.Margins(0,0,0,0)
    $doc.OriginAtMargins=$false
    $left=[int][Math]::Floor(($paperWidth-$imageWidth)/2)
    $handler=[Drawing.Printing.PrintPageEventHandler]{param($sender,$e)
      $e.Graphics.DrawImage($Image,$left,0,$imageWidth,$imageHeight)
      $e.HasMorePages=$false
    }.GetNewClosure()
    $doc.add_PrintPage($handler)
    try{$doc.Print()}finally{$doc.remove_PrintPage($handler)}
    return @{ok=$true;printer=$Printer;width=$paperWidth;height=$paperHeight;mode='Citizen Windows driver'}
  }finally{$doc.Dispose()}
}
function Print-Receipt($Payload){
  $printer=[string]$Payload.printer;if([string]::IsNullOrWhiteSpace($printer)){$printer='CITIZEN CT-D150'}
  $encoded=[string]$Payload.imageDataUrl;if($encoded -notmatch '^data:image/png;base64,'){throw 'Invalid receipt image'}
  $raw=[Convert]::FromBase64String(($encoded-replace'^data:image/png;base64,',''));$ms=New-Object IO.MemoryStream(,$raw);$image=[Drawing.Image]::FromStream($ms)
  try{
    # Prefer the installed Citizen driver. Unlike the browser's fixed 279 mm
    # page, this supplies the exact content height and returns without the RAW
    # USB spooler deadlock seen on some CT-D150 installations.
    return Print-WithCitizenDriver $printer $image
    <# Legacy ESC/POS fallback retained below for older installations.
    $dotWidth=512
    $dotHeight=[Math]::Max(1,[int][Math]::Ceiling($image.Height*($dotWidth/[double]$image.Width)))
    $bmp=New-Object Drawing.Bitmap($dotWidth,$dotHeight,[Drawing.Imaging.PixelFormat]::Format24bppRgb)
    try{
      $g=[Drawing.Graphics]::FromImage($bmp)
      try{
        $g.Clear([Drawing.Color]::White)
        $g.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.PixelOffsetMode=[Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.DrawImage($image,0,0,$dotWidth,$dotHeight)
      }finally{$g.Dispose()}
      $rowBytes=[int][Math]::Ceiling($dotWidth/8.0)
      $bytes=[Collections.Generic.List[byte]]::new()
      $bytes.AddRange([byte[]]@(0x1B,0x40,0x1B,0x61,0x00,0x1D,0x4C,0x00,0x00))
      $bytes.AddRange([byte[]]@(0x1D,0x76,0x30,0x00,($rowBytes-band 0xFF),(($rowBytes-shr 8)-band 0xFF),($dotHeight-band 0xFF),(($dotHeight-shr 8)-band 0xFF)))
      for($y=0;$y-lt$dotHeight;$y++){
        for($bx=0;$bx-lt$rowBytes;$bx++){
          $value=0
          for($bit=0;$bit-lt 8;$bit++){
            $x=$bx*8+$bit
            if($x-lt$dotWidth){
              $p=$bmp.GetPixel($x,$y)
              $luma=(299*[int]$p.R+587*[int]$p.G+114*[int]$p.B)/1000
              if($luma-lt 190){$value=$value-bor(0x80-shr$bit)}
            }
          }
          $bytes.Add([byte]$value)
        }
      }
      $bytes.AddRange([byte[]]@(0x0A,0x1D,0x56,0x42,0x00))
      [GoldleafRawPrinter]::Send($printer,$bytes.ToArray())
    }finally{$bmp.Dispose()}
    return @{ok=$true;printer=$printer;widthDots=$dotWidth;heightDots=$dotHeight;mode='ESC-POS raw'}
    #>
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
