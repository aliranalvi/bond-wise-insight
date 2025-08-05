import React, { useState } from 'react';
import { Upload, FileSpreadsheet, TrendingUp, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { BondAnalysisView } from './BondAnalysisView';

interface BondData {
  bondName: string;
  isin: string;
  units: number;
  investedAmount: number;
  faceValue: number;
  acquisitionCost: number;
  dateOfInvestment: string;
  maturityDate: string;
  xirr: number;
  interestFrequency: string;
  principalFrequency: string;
  bondIssuer: string;
  matured: boolean;
  monthYear: string;
}

interface RepaymentData {
  date: string;
  bondName: string;
  isin: string;
  units: number;
  amountInBank: number;
  principalRepaid: number;
  interestPaidBeforeTDS: number;
  interestPaidAfterTDS: number;
  tdsDeducted: number;
}

interface PivotData {
  [issuer: string]: {
    [bondName: string]: {
      [monthYear: string]: number;
    };
  };
}

export const BondAnalyzer = () => {
  const [bondData, setBondData] = useState<BondData[]>([]);
  const [repaymentData, setRepaymentData] = useState<RepaymentData[]>([]);
  const [pivotData, setPivotData] = useState<PivotData>({});
  const [isUploading, setIsUploading] = useState(false);
  const [hasData, setHasData] = useState(false);
  const { toast } = useToast();

  const extractBondIssuer = (bondName: string): string => {
    // Remove numeric suffixes, date patterns, and clean up the issuer name
    return bondName
      .replace(/-\d+(\s+[A-Za-z]+'\d+)?$/, '') // Remove "-2 Jul'23" or "-2" patterns
      .replace(/\s+[A-Za-z]+'\d+$/, '') // Remove " Jul'23" patterns  
      .replace(/\s+\d+$/, '') // Remove trailing numbers
      .trim();
  };

  const formatMonthYear = (dateStr: string): string => {
    try {
      // Handle DD/MM/YYYY format
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }
      // Fallback for other formats
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const isMatured = (maturityDateStr: string): boolean => {
    try {
      // Handle DD/MM/YYYY format
      const parts = maturityDateStr.split('/');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        const maturityDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        const today = new Date();
        return maturityDate < today;
      }
      // Fallback for other formats
      const maturityDate = new Date(maturityDateStr);
      const today = new Date();
      return maturityDate < today;
    } catch {
      return false;
    }
  };

  const cleanAndParseData = (worksheet: XLSX.WorkSheet): BondData[] => {
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    const cleanedData: BondData[] = [];
    
    let headerRowIndex = -1;
    
    // Find the header row
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i] as any[];
      if (row && row.some(cell => 
        cell && typeof cell === 'string' && 
        (cell.toLowerCase().includes('bond name') || cell.toLowerCase().includes('isin'))
      )) {
        headerRowIndex = i;
        break;
      }
    }
    
    if (headerRowIndex === -1) {
      throw new Error('Could not find header row in the Excel file');
    }
    
    const headers = rawData[headerRowIndex] as string[];
    
    // Map column indices
    const columnMap: { [key: string]: number } = {};
    headers.forEach((header, index) => {
      if (header && typeof header === 'string') {
        const cleanHeader = header.toLowerCase().trim();
        if (cleanHeader.includes('bond name')) columnMap.bondName = index;
        else if (cleanHeader.includes('isin')) columnMap.isin = index;
        else if (cleanHeader.includes('no. of units') || cleanHeader.includes('units')) columnMap.units = index;
        else if (cleanHeader.includes('invested amount')) columnMap.investedAmount = index;
        else if (cleanHeader.includes('face value')) columnMap.faceValue = index;
        else if (cleanHeader.includes('acquisition cost')) columnMap.acquisitionCost = index;
        else if (cleanHeader.includes('date of investment')) columnMap.dateOfInvestment = index;
        else if (cleanHeader.includes('maturity date')) columnMap.maturityDate = index;
        else if (cleanHeader.includes('xirr')) columnMap.xirr = index;
        else if (cleanHeader.includes('frequency of interest')) columnMap.interestFrequency = index;
        else if (cleanHeader.includes('frequency of principal')) columnMap.principalFrequency = index;
      }
    });
    
    // Process data rows
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i] as any[];
      
      if (!row || row.length === 0) continue;
      
      // Skip empty rows or rows that look like headers/totals
      const firstCell = row[0];
      if (!firstCell || 
          (typeof firstCell === 'string' && 
           (firstCell.toLowerCase().includes('total') || 
            firstCell.toLowerCase().includes('bond name') ||
            firstCell.trim() === ''))) {
        continue;
      }
      
      try {
        const bondName = row[columnMap.bondName]?.toString() || '';
        if (!bondName) continue;
        
        const investedAmount = parseFloat(row[columnMap.investedAmount]?.toString().replace(/[^\d.-]/g, '') || '0');
        if (investedAmount <= 0) continue;
        
        const bondData: BondData = {
          bondName,
          isin: row[columnMap.isin]?.toString() || '',
          units: parseFloat(row[columnMap.units]?.toString() || '0'),
          investedAmount,
          faceValue: parseFloat(row[columnMap.faceValue]?.toString().replace(/[^\d.-]/g, '') || '0'),
          acquisitionCost: parseFloat(row[columnMap.acquisitionCost]?.toString().replace(/[^\d.-]/g, '') || '0'),
          dateOfInvestment: row[columnMap.dateOfInvestment]?.toString() || '',
          maturityDate: row[columnMap.maturityDate]?.toString() || '',
          xirr: parseFloat(row[columnMap.xirr]?.toString().replace(/[^\d.-]/g, '') || '0'),
          interestFrequency: row[columnMap.interestFrequency]?.toString() || '',
          principalFrequency: row[columnMap.principalFrequency]?.toString() || '',
          bondIssuer: extractBondIssuer(bondName),
          matured: isMatured(row[columnMap.maturityDate]?.toString() || ''),
          monthYear: formatMonthYear(row[columnMap.dateOfInvestment]?.toString() || ''),
        };
        
        cleanedData.push(bondData);
      } catch (error) {
        console.warn('Error processing row:', i, error);
        continue;
      }
    }
    
    return cleanedData;
  };

  const cleanAndParseRepaymentData = (worksheet: XLSX.WorkSheet): RepaymentData[] => {
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    const cleanedData: RepaymentData[] = [];
    
    let headerRowIndex = -1;
    
    // Find the header row
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i] as any[];
      if (row && row.some(cell => 
        cell && typeof cell === 'string' && 
        (cell.toLowerCase().includes('date') && cell.toLowerCase().includes('name of bond'))
      )) {
        headerRowIndex = i;
        break;
      }
    }
    
    if (headerRowIndex === -1) {
      return []; // No repayment data found
    }
    
    const headers = rawData[headerRowIndex] as string[];
    
    // Map column indices
    const columnMap: { [key: string]: number } = {};
    headers.forEach((header, index) => {
      if (header && typeof header === 'string') {
        const cleanHeader = header.toLowerCase().trim();
        if (cleanHeader.includes('date') && !cleanHeader.includes('maturity')) columnMap.date = index;
        else if (cleanHeader.includes('name of bond')) columnMap.bondName = index;
        else if (cleanHeader.includes('isin')) columnMap.isin = index;
        else if (cleanHeader.includes('no. of units')) columnMap.units = index;
        else if (cleanHeader.includes('amount in bank')) columnMap.amountInBank = index;
        else if (cleanHeader.includes('principal repaid')) columnMap.principalRepaid = index;
        else if (cleanHeader.includes('interest paid (before tds deduction)')) columnMap.interestPaidBeforeTDS = index;
        else if (cleanHeader.includes('interest paid (after tds deduction)')) columnMap.interestPaidAfterTDS = index;
        else if (cleanHeader.includes('tds deducted')) columnMap.tdsDeducted = index;
      }
    });
    
    // Process data rows
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i] as any[];
      
      if (!row || row.length === 0) continue;
      
      // Skip empty rows or rows that look like headers/totals
      const firstCell = row[0];
      const bondNameCell = row[columnMap.bondName];
      
      if (!firstCell || !bondNameCell || 
          (typeof firstCell === 'string' && 
           (firstCell.toLowerCase().includes('total') || 
            firstCell.toLowerCase().includes('date') ||
            firstCell.toLowerCase().includes('grand') ||
            firstCell.trim() === '')) ||
          (typeof bondNameCell === 'string' && 
           (bondNameCell.toLowerCase().includes('total') || 
            bondNameCell.toLowerCase().includes('name of bond') ||
            bondNameCell.trim() === ''))) {
        continue;
      }
      
      // Validate date format (DD/MM/YYYY)
      const dateStr = row[columnMap.date]?.toString() || '';
      if (!dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
        continue;
      }
      
      const bondName = bondNameCell?.toString() || '';
      if (!bondName) continue;
      
      try {
        const repaymentEntry: RepaymentData = {
          date: dateStr,
          bondName,
          isin: row[columnMap.isin]?.toString() || '',
          units: parseFloat(row[columnMap.units]?.toString() || '0'),
          amountInBank: parseFloat(row[columnMap.amountInBank]?.toString().replace(/[^\d.-]/g, '') || '0'),
          principalRepaid: parseFloat(row[columnMap.principalRepaid]?.toString().replace(/[^\d.-]/g, '') || '0'),
          interestPaidBeforeTDS: parseFloat(row[columnMap.interestPaidBeforeTDS]?.toString().replace(/[^\d.-]/g, '') || '0'),
          interestPaidAfterTDS: parseFloat(row[columnMap.interestPaidAfterTDS]?.toString().replace(/[^\d.-]/g, '') || '0'),
          tdsDeducted: parseFloat(row[columnMap.tdsDeducted]?.toString().replace(/[^\d.-]/g, '') || '0'),
        };
        
        cleanedData.push(repaymentEntry);
      } catch (error) {
        console.warn('Error processing repayment row:', i, error);
        continue;
      }
    }
    
    return cleanedData;
  };

  const generatePivotData = (data: BondData[]): PivotData => {
    const pivot: PivotData = {};
    
    // Only include active (non-matured) investments
    const activeData = data.filter(bond => !bond.matured);
    
    activeData.forEach(bond => {
      if (!pivot[bond.bondIssuer]) {
        pivot[bond.bondIssuer] = {};
      }
      
      if (!pivot[bond.bondIssuer][bond.bondIssuer]) {
        pivot[bond.bondIssuer][bond.bondIssuer] = {};
      }
      
      if (!pivot[bond.bondIssuer][bond.bondIssuer][bond.monthYear]) {
        pivot[bond.bondIssuer][bond.bondIssuer][bond.monthYear] = 0;
      }
      
      pivot[bond.bondIssuer][bond.bondIssuer][bond.monthYear] += bond.investedAmount;
    });
    
    return pivot;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File upload triggered', event.target.files);
    const file = event.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }
    
    console.log('Processing file:', file.name, file.type);
    setIsUploading(true);
    
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      
      console.log('Workbook sheets:', workbook.SheetNames);
      
      // Look for 'Investment Summary Report' sheet or use the first sheet
      let worksheetName = workbook.SheetNames.find(name => 
        name.toLowerCase().includes('investment summary') || 
        name.toLowerCase().includes('summary')
      ) || workbook.SheetNames[0];
      
      console.log('Using worksheet:', worksheetName);
      
      const worksheet = workbook.Sheets[worksheetName];
      const parsedData = cleanAndParseData(worksheet);
      
      // Look for 'Repayment Summary Report' sheet
      let repaymentWorksheetName = workbook.SheetNames.find(name => 
        name.toLowerCase().includes('repayment summary') || 
        name.toLowerCase().includes('repayment')
      );
      
      let repaymentParsedData: RepaymentData[] = [];
      if (repaymentWorksheetName) {
        console.log('Using repayment worksheet:', repaymentWorksheetName);
        const repaymentWorksheet = workbook.Sheets[repaymentWorksheetName];
        repaymentParsedData = cleanAndParseRepaymentData(repaymentWorksheet);
        console.log('Parsed repayment data:', repaymentParsedData.length, 'records');
      }
      
      console.log('Parsed data:', parsedData.length, 'records');
      
      if (parsedData.length === 0) {
        throw new Error('No valid bond data found in the file');
      }
      
      const pivot = generatePivotData(parsedData);
      
      setBondData(parsedData);
      setRepaymentData(repaymentParsedData);
      setPivotData(pivot);
      setHasData(true);
      
      toast({
        title: "File uploaded successfully!",
        description: `Processed ${parsedData.length} bond investments`,
      });
      
    } catch (error) {
      console.error('Error processing file:', error);
      toast({
        title: "Error processing file",
        description: error instanceof Error ? error.message : "Please check your file format and try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const totalInvestment = bondData.reduce((sum, bond) => sum + bond.investedAmount, 0);
  const totalMatured = bondData.filter(bond => bond.matured).length;
  const totalActive = bondData.length - totalMatured;
  const maturedInvestment = bondData.filter(bond => bond.matured).reduce((sum, bond) => sum + bond.investedAmount, 0);
  const activeInvestment = totalInvestment - maturedInvestment;

  if (!hasData) {
    return (
      <div className="min-h-screen bg-gradient-soft flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl shadow-medium bg-gradient-card border-0">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center">
              <TrendingUp className="w-10 h-10 text-primary" />
            </div>
            <div>
              <CardTitle className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Bond Investment Analyzer
              </CardTitle>
              <CardDescription className="text-lg mt-2">
                Upload your investment summary Excel file to analyze your bond portfolio
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="border-2 border-dashed border-primary/20 rounded-xl p-8 text-center space-y-4 hover:border-primary/40 transition-colors">
              <FileSpreadsheet className="w-12 h-12 text-primary mx-auto" />
              <div>
                <h3 className="text-lg font-semibold mb-2">Upload Excel File</h3>
                <p className="text-muted-foreground mb-4">
                  Select your Investment Summary Report from Wint Wealth or similar platforms
                </p>
                <input
                  id="file-upload"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <Button 
                  variant="default" 
                  size="lg" 
                  className="cursor-pointer shadow-soft hover:shadow-glow transition-all duration-300"
                  disabled={isUploading}
                  onClick={() => {
                    console.log('Button clicked');
                    document.getElementById('file-upload')?.click();
                  }}
                >
                  <Upload className="w-5 h-5 mr-2" />
                  {isUploading ? 'Processing...' : 'Choose File'}
                </Button>
              </div>
            </div>
            
            <div className="bg-primary-glow/20 rounded-xl p-4">
              <h4 className="font-semibold mb-2 text-primary">Expected File Format:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Investment Summary Report sheet</li>
                <li>• Columns: Bond Name, ISIN, Invested Amount, Date of Investment, Maturity Date</li>
                <li>• Excel format (.xlsx or .xls)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-soft p-4 space-y-6">
      {/* Header Stats */}
      <div className="max-w-7xl mx-auto">
        {/* Header with Upload Button */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-2">
              WintWealth: Bonds Portfolio Investment Analysis
            </h1>
            <p className="text-muted-foreground">
              Analysis of {bondData.length} bond investments
            </p>
          </div>
          
          <div>
            <input
              id="file-upload-new"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <Button 
              variant="outline" 
              className="shadow-soft"
              disabled={isUploading}
              onClick={() => {
                console.log('New file button clicked');
                document.getElementById('file-upload-new')?.click();
              }}
            >
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? 'Processing...' : 'Upload New File'}
            </Button>
          </div>
        </div>
        
        <TooltipProvider>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4 mb-6">
            <Tooltip>
              <TooltipTrigger asChild>
                <Card className="shadow-soft bg-gradient-card border-0 flex-1">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Investment</p>
                        <p className="text-lg font-bold">₹{totalInvestment.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <p>Sum of all investments across active and matured bonds</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Card className="shadow-soft bg-gradient-card border-0 flex-1">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-success" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Active Bonds</p>
                        <p className="text-lg font-bold text-success">{totalActive}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <p>Number of bonds that have not yet matured</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Card className="shadow-soft bg-gradient-card border-0 flex-1">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-success" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Active Investment</p>
                        <p className="text-lg font-bold text-success">₹{activeInvestment.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <p>Total invested amount in bonds that have not yet matured</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Card className="shadow-soft bg-gradient-card border-0 flex-1">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-warning/10 rounded-lg flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-warning" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Matured Bonds</p>
                        <p className="text-lg font-bold text-warning">{totalMatured}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <p>Number of bonds that have already matured</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Card className="shadow-soft bg-gradient-card border-0 flex-1">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-warning/10 rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-warning" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Matured Investment</p>
                        <p className="text-lg font-bold text-warning">₹{maturedInvestment.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <p>Total invested amount in bonds that have already matured</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Card className="shadow-soft bg-gradient-card border-0 flex-1">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
                        <FileSpreadsheet className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Unique Issuers</p>
                        <p className="text-lg font-bold text-accent">{Object.keys(pivotData).length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <p>Number of unique bond issuers in your portfolio</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Card className="shadow-soft bg-gradient-card border-0 flex-1">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Overall XIRR</p>
                        <p className="text-lg font-bold text-primary">
                          {bondData.length > 0 ? 
                            (bondData.reduce((sum, bond) => sum + bond.xirr, 0) / bondData.length).toFixed(2) + '%' : 
                            '0.00%'
                          }
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent>
                <p>Average XIRR across all bonds (active and matured)</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
        
        {/* Combined Chart and Table */}
        <BondAnalysisView pivotData={pivotData} bondData={bondData} repaymentData={repaymentData} />
      </div>
    </div>
  );
};