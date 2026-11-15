# Foto Mágica print helper for the DNP DS-RX1 (DESIGN §10).
#
# Started once by main (WindowsDnpPrinter) with Windows PowerShell 5.1, kept alive, and fed one JSON
# request per line on stdin. Each answer is one line on stdout prefixed with 'FMJ '. Both directions
# are ASCII: main escapes non-ASCII as \uXXXX, and so does this script.
#
# Actions:
#   list          every local queue: name, PRINTER_STATUS bits, "use printer offline"
#   capabilities  the queue's PrintCapabilities as features and options (qualified names)
#   print         merge the requested options into the queue's ticket, check the driver kept the
#                 required ones (the 2inch cut first), convert the ticket to a DEVMODE and print the
#                 JPEG with System.Drawing: no dialog, one page per copy, the whole page covered.
#
# Choosing the options is not done here: main decides from the capabilities, in tested TypeScript.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Printing
Add-Type -AssemblyName ReachFramework
Add-Type -AssemblyName System.Drawing

$PSF = 'http://schemas.microsoft.com/windows/2003/08/printing/printschemaframework'
$PSK = 'http://schemas.microsoft.com/windows/2003/08/printing/printschemakeywords'
$server = New-Object System.Printing.LocalPrintServer
$queueTypes = [System.Printing.EnumeratedPrintQueueTypes[]]@('Local', 'Connections')

function Write-Response($response) {
  $json = ConvertTo-Json -InputObject $response -Compress -Depth 10
  $json = [regex]::Replace($json, '[^\x00-\x7F]', { param($m) '\u{0:x4}' -f [int][char]$m.Value })
  [Console]::Out.WriteLine('FMJ ' + $json)
  [Console]::Out.Flush()
}

function Fail([string]$stage, [string]$message) {
  return @{ ok = $false; stage = $stage; message = $message }
}

function Resolve-QName([System.Xml.XmlNode]$node, [string]$qname) {
  if (-not $qname) { return $null }
  $parts = $qname.Split(':', 2)
  if ($parts.Length -eq 2) { $ns = $node.GetNamespaceOfPrefix($parts[0]); $local = $parts[1] }
  else { $ns = $node.GetNamespaceOfPrefix(''); $local = $parts[0] }
  if (-not $ns) { $ns = '' }
  return @{ ns = $ns; name = $local }
}

function Test-PsfChild($node, [string]$localName) {
  return ($node.NodeType -eq [System.Xml.XmlNodeType]::Element -and $node.LocalName -eq $localName -and $node.NamespaceURI -eq $PSF)
}

function Get-DisplayName([System.Xml.XmlElement]$element) {
  foreach ($property in $element.ChildNodes) {
    if (-not (Test-PsfChild $property 'Property')) { continue }
    $q = Resolve-QName $property $property.GetAttribute('name')
    if ($q -and $q.ns -eq $PSK -and $q.name -eq 'DisplayName') {
      foreach ($value in $property.ChildNodes) { if (Test-PsfChild $value 'Value') { return $value.InnerText } }
    }
  }
  return $null
}

function Get-Scored([System.Xml.XmlElement]$element) {
  $scored = @{}
  foreach ($property in $element.ChildNodes) {
    if (-not (Test-PsfChild $property 'ScoredProperty')) { continue }
    $q = Resolve-QName $property $property.GetAttribute('name')
    if (-not $q -or $q.ns -ne $PSK) { continue }
    foreach ($value in $property.ChildNodes) {
      if (-not (Test-PsfChild $value 'Value')) { continue }
      $number = 0.0
      if ([double]::TryParse($value.InnerText, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$number)) {
        $scored[$q.name] = $number
      }
    }
  }
  return $scored
}

function New-PsfNamespaces([System.Xml.XmlDocument]$document) {
  $namespaces = New-Object System.Xml.XmlNamespaceManager($document.NameTable)
  $namespaces.AddNamespace('psf', $PSF)
  return ,$namespaces
}

function Get-Queue([string]$name) {
  foreach ($queue in $server.GetPrintQueues($queueTypes)) {
    if ($queue.FullName -eq $name -or $queue.Name -eq $name) { return $queue }
    $queue.Dispose()
  }
  return $null
}

function Invoke-List {
  $workOffline = @{}
  try {
    foreach ($printer in (Get-CimInstance -ClassName Win32_Printer -Property Name, WorkOffline -ErrorAction Stop)) {
      $workOffline[$printer.Name] = [bool]$printer.WorkOffline
    }
  } catch { }
  $printers = New-Object System.Collections.ArrayList
  foreach ($queue in $server.GetPrintQueues($queueTypes)) {
    $offline = $null
    if ($workOffline.ContainsKey($queue.FullName)) { $offline = $workOffline[$queue.FullName] }
    elseif ($workOffline.ContainsKey($queue.Name)) { $offline = $workOffline[$queue.Name] }
    [void]$printers.Add(@{ name = $queue.FullName; status = [int]$queue.QueueStatus; workOffline = $offline })
    $queue.Dispose()
  }
  return @{ ok = $true; printers = $printers }
}

function Invoke-Capabilities([string]$name) {
  $queue = Get-Queue $name
  if (-not $queue) { return (Fail 'not-found' "queue not found: $name") }
  try {
    $document = New-Object System.Xml.XmlDocument
    $document.Load($queue.GetPrintCapabilitiesAsXml())
    $namespaces = New-PsfNamespaces $document
    $features = New-Object System.Collections.ArrayList
    foreach ($feature in $document.SelectNodes('//psf:Feature', $namespaces)) {
      $q = Resolve-QName $feature $feature.GetAttribute('name')
      if (-not $q) { continue }
      $options = New-Object System.Collections.ArrayList
      foreach ($option in $feature.ChildNodes) {
        if (-not (Test-PsfChild $option 'Option')) { continue }
        $oq = Resolve-QName $option $option.GetAttribute('name')
        if (-not $oq) { continue }
        [void]$options.Add(@{ ns = $oq.ns; name = $oq.name; displayName = (Get-DisplayName $option); scored = (Get-Scored $option) })
      }
      [void]$features.Add(@{ ns = $q.ns; name = $q.name; displayName = (Get-DisplayName $feature); options = $options })
    }
    return @{ ok = $true; features = $features }
  } finally {
    $queue.Dispose()
  }
}

function New-DeltaTicket($settings) {
  $prefixes = @{}
  $index = 0
  foreach ($setting in $settings) {
    foreach ($uri in @($setting.feature.ns, $setting.option.ns)) {
      if (-not $prefixes.ContainsKey($uri)) { $prefixes[$uri] = "n$index"; $index++ }
    }
  }
  $xml = New-Object System.Text.StringBuilder
  [void]$xml.Append('<?xml version="1.0" encoding="UTF-8"?><psf:PrintTicket version="1" xmlns:psf="' + $PSF + '"')
  foreach ($uri in $prefixes.Keys) { [void]$xml.Append(' xmlns:' + $prefixes[$uri] + '="' + [Security.SecurityElement]::Escape($uri) + '"') }
  [void]$xml.Append('>')
  foreach ($setting in $settings) {
    $feature = $prefixes[$setting.feature.ns] + ':' + $setting.feature.name
    $option = $prefixes[$setting.option.ns] + ':' + $setting.option.name
    [void]$xml.Append('<psf:Feature name="' + $feature + '"><psf:Option name="' + $option + '"/></psf:Feature>')
  }
  [void]$xml.Append('</psf:PrintTicket>')
  $stream = New-Object System.IO.MemoryStream -ArgumentList (, [Text.Encoding]::UTF8.GetBytes($xml.ToString()))
  return (New-Object System.Printing.PrintTicket -ArgumentList $stream)
}

function Find-SelectedOption([System.Xml.XmlDocument]$document, $namespaces, $wanted) {
  foreach ($feature in $document.SelectNodes('//psf:Feature', $namespaces)) {
    $q = Resolve-QName $feature $feature.GetAttribute('name')
    if (-not $q -or $q.ns -ne $wanted.ns -or $q.name -ne $wanted.name) { continue }
    foreach ($option in $feature.ChildNodes) {
      if (Test-PsfChild $option 'Option') { return (Resolve-QName $option $option.GetAttribute('name')) }
    }
    return $null
  }
  return $null
}

function Send-Job([string]$printer, [byte[]]$devmode, $request) {
  $image = [System.Drawing.Image]::FromFile($request.jpegPath)
  $document = New-Object System.Drawing.Printing.PrintDocument
  $handle = [Runtime.InteropServices.Marshal]::AllocHGlobal($devmode.Length)
  try {
    [Runtime.InteropServices.Marshal]::Copy($devmode, 0, $handle, $devmode.Length)
    $document.PrinterSettings.PrinterName = $printer
    if (-not $document.PrinterSettings.IsValid) { return (Fail 'not-found' "printer settings invalid for $printer") }
    # The DEVMODE carries the driver's private part too, where the 2inch cut lives.
    $document.PrinterSettings.SetHdevmode($handle)
    $document.DefaultPageSettings.SetHdevmode($handle)
    $document.PrinterSettings.Copies = 1
    $document.DocumentName = $request.documentName
    # StandardPrintController: no "Printing page 1" window either.
    $document.PrintController = New-Object System.Drawing.Printing.StandardPrintController

    $bounds = $document.DefaultPageSettings.Bounds
    if (($bounds.Width -gt $bounds.Height) -ne ($image.Width -gt $image.Height)) {
      return (Fail 'page' ("driver page is {0}x{1} (1/100 in), montage is {2}x{3} px: not rotating or stretching it" -f $bounds.Width, $bounds.Height, $image.Width, $image.Height))
    }

    $global:fmJobImage = $image
    $global:fmPagesLeft = [int]$request.copies
    $document.add_PrintPage([System.Drawing.Printing.PrintPageEventHandler] {
        param($sender, $page)
        $graphics = $page.Graphics
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        # The origin is the printable corner; shifting by the hard margin covers the whole sheet.
        $margins = $page.PageSettings
        $graphics.DrawImage($global:fmJobImage, [single](-$margins.HardMarginX), [single](-$margins.HardMarginY), [single]$page.PageBounds.Width, [single]$page.PageBounds.Height)
        $global:fmPagesLeft--
        $page.HasMorePages = ($global:fmPagesLeft -gt 0)
      })
    try {
      $document.Print()
    } catch {
      return (Fail 'spool' $_.Exception.Message)
    }
    return @{ ok = $true; page = @{ width = $bounds.Width; height = $bounds.Height } }
  } finally {
    [Runtime.InteropServices.Marshal]::FreeHGlobal($handle)
    $global:fmJobImage = $null
    $document.Dispose()
    $image.Dispose()
  }
}

function Invoke-Print($request) {
  $queue = Get-Queue $request.printer
  if (-not $queue) { return (Fail 'not-found' "queue not found: $($request.printer)") }
  try {
    $base = $queue.UserPrintTicket
    if (-not $base) { $base = $queue.DefaultPrintTicket }
    $merged = $queue.MergeAndValidatePrintTicket($base, (New-DeltaTicket $request.settings))
    $ticket = $merged.ValidatedPrintTicket

    # The driver may resolve a conflict by changing an option: a required one changed stops here.
    $document = New-Object System.Xml.XmlDocument
    $document.Load($ticket.GetXmlStream())
    $namespaces = New-PsfNamespaces $document
    foreach ($setting in $request.settings) {
      if (-not $setting.required) { continue }
      $got = Find-SelectedOption $document $namespaces $setting.feature
      if (-not $got -or $got.ns -ne $setting.option.ns -or $got.name -ne $setting.option.name) {
        $kept = 'nothing'
        if ($got) { $kept = $got.name }
        $response = Fail 'rejected' ("driver kept {0} for {1} instead of {2}" -f $kept, $setting.feature.name, $setting.option.name)
        $response['role'] = $setting.role
        $response['got'] = $got
        return $response
      }
    }

    $converter = New-Object System.Printing.Interop.PrintTicketConverter -ArgumentList $queue.FullName, ([System.Printing.Interop.PrintTicketConverter]::MaxPrintSchemaVersion)
    try {
      $devmode = $converter.ConvertPrintTicketToDevMode($ticket, [System.Printing.Interop.BaseDevModeType]::UserDefault)
    } finally {
      $converter.Dispose()
    }
    return (Send-Job $queue.FullName $devmode $request)
  } finally {
    $queue.Dispose()
  }
}

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  if (-not $line.Trim()) { continue }
  $id = $null
  try {
    $request = ConvertFrom-Json -InputObject $line
    $id = $request.id
    switch ($request.action) {
      'list' { $response = Invoke-List }
      'capabilities' { $response = Invoke-Capabilities $request.printer }
      'print' { $response = Invoke-Print $request }
      default { $response = Fail 'exception' "unknown action: $($request.action)" }
    }
  } catch {
    $response = Fail 'exception' $_.Exception.Message
  }
  # A stray value written by a .NET call would turn the answer into an array; the answer is the last item.
  if ($response -is [array]) { $response = $response[-1] }
  if ($null -ne $id) {
    $response['id'] = [int]$id
    Write-Response $response
  }
}
