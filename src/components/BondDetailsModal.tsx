import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CalendarDays, TrendingUp, Percent, Clock, Banknote, Receipt, Info, AlertTriangle } from 'lucide-react';

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

interface RepaymentScheduleEntry {
  date: string;
  principalPayment: number;
  interestPayment: number;
  principalBalance: number;
  totalPayment: number;
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

interface BondDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  bondData: BondData | null;
  bondName: string;
  issuer: string;
  repaymentData: RepaymentData[];
  allBondData: BondData[]; // Add this to access all investment data
}

export const BondDetailsModal: React.FC<BondDetailsModalProps> = ({
  isOpen,
  onClose,
  bondData,
  bondName,
  issuer,
  repaymentData,
  allBondData
}) => {
  const formatCurrency = (amount: number): string => {
    return `₹${amount.toLocaleString('en-IN', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr.split('/').reverse().join('-')).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Filter repayment data for this specific bond using Bond Name + ISIN combination
  const bondRepaymentData = repaymentData.filter(entry => 
    entry.bondName === bondName && entry.isin === bondData?.isin
  );
  
  // Get all investment entries for this bond series (bondName + ISIN) to calculate total units and investment
  const allInvestmentEntries = allBondData.filter(bond => 
    bond.bondName === bondName && bond.isin === bondData?.isin
  );
  
  const totalUnits = allInvestmentEntries.reduce((sum, bond) => sum + bond.units, 0);
  const totalInvestment = allInvestmentEntries.reduce((sum, bond) => sum + bond.investedAmount, 0);

  // Calculate actual payments from repayment data
  const actualPrincipalRepaid = bondRepaymentData.reduce((sum, entry) => sum + entry.principalRepaid, 0);
  const actualInterestPaidBeforeTDS = bondRepaymentData.reduce((sum, entry) => sum + entry.interestPaidBeforeTDS, 0);
  const actualInterestPaidAfterTDS = bondRepaymentData.reduce((sum, entry) => sum + entry.interestPaidAfterTDS, 0);

  // Generate repayment schedule based only on actual Excel data
  const generateRepaymentSchedule = (): (RepaymentScheduleEntry & { status: 'Paid' | 'Yet To Be Paid' })[] => {
    if (!bondData) return [];
    
    // Only use actual Excel data, no projections
    return bondRepaymentData.map(entry => ({
      date: entry.date,
      principalPayment: entry.principalRepaid,
      interestPayment: entry.interestPaidBeforeTDS,
      principalBalance: 0, // We'll calculate this based on cumulative principal repaid
      totalPayment: entry.principalRepaid + entry.interestPaidBeforeTDS,
      status: 'Paid' as const
    })).sort((a, b) => {
      // Sort by date
      const [dayA, monthA, yearA] = a.date.split('/');
      const [dayB, monthB, yearB] = b.date.split('/');
      const dateA = new Date(parseInt(yearA), parseInt(monthA) - 1, parseInt(dayA));
      const dateB = new Date(parseInt(yearB), parseInt(monthB) - 1, parseInt(dayB));
      return dateA.getTime() - dateB.getTime();
    }).map((entry, index, array) => {
        // Calculate principal balance based on cumulative principal repaid
        const cumulativePrincipalRepaid = array.slice(0, index + 1).reduce((sum, e) => sum + e.principalPayment, 0);
        return {
          ...entry,
          principalBalance: Math.max(0, totalInvestment - cumulativePrincipalRepaid)
        };
    });
  };

  const repaymentSchedule = generateRepaymentSchedule();
  const principalRemaining = totalInvestment - actualPrincipalRepaid;

  // Calculate missed interest payments for monthly bonds
  const getMissedInterestMonths = (): string[] => {
    if (!bondData || bondData.interestFrequency !== 'Monthly') return [];
    
    const investmentDate = new Date(bondData.dateOfInvestment.split('/').reverse().join('-'));
    const currentDate = new Date();
    const maturityDate = new Date(bondData.maturityDate.split('/').reverse().join('-'));
    
    // Interest payments start from the next month after investment
    const startDate = new Date(investmentDate.getFullYear(), investmentDate.getMonth() + 1, 1);
    const endDate = currentDate < maturityDate ? currentDate : maturityDate;
    
    const expectedMonths: Date[] = [];
    const currentMonth = new Date(startDate);
    
    while (currentMonth <= endDate) {
      expectedMonths.push(new Date(currentMonth));
      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }
    
    // Get actual interest payment months for this bond
    const actualPaymentMonths = bondRepaymentData
      .filter(entry => entry.interestPaidBeforeTDS > 0)
      .map(entry => new Date(entry.date.split('/').reverse().join('-')));
    
    // Find missed months
    const missedMonths = expectedMonths.filter(expectedMonth => {
      return expectedMonth < currentDate && !actualPaymentMonths.some(paymentMonth => 
        paymentMonth.getMonth() === expectedMonth.getMonth() && 
        paymentMonth.getFullYear() === expectedMonth.getFullYear()
      );
    });
    
    return missedMonths.map(date => 
      date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    );
  };

  const missedInterestMonths = getMissedInterestMonths();

  if (!bondData) return null;

  return (
    <TooltipProvider>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-gradient-card border-0">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-primary flex items-center gap-2">
              <TrendingUp className="w-6 h-6" />
              {bondName}
            </DialogTitle>
            <DialogDescription className="text-base">
              Issued by <span className="font-semibold text-primary">{issuer}</span> • ISIN: {bondData.isin}
            </DialogDescription>
          </DialogHeader>

        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-subtle border-primary/20">
              <CardHeader className="pb-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <CardTitle className="text-sm flex items-center gap-2 cursor-help">
                      <Banknote className="w-4 h-4 text-primary" />
                      Principal
                      <Info className="w-3 h-3 text-muted-foreground" />
                    </CardTitle>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Total principal amount invested in this bond</p>
                  </TooltipContent>
                </Tooltip>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold text-primary">{formatCurrency(totalInvestment)}</p>
                <p className="text-xs text-muted-foreground">{totalUnits.toLocaleString()} units</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-subtle border-primary/20">
              <CardHeader className="pb-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <CardTitle className="text-sm flex items-center gap-2 cursor-help">
                      <Percent className="w-4 h-4 text-success" />
                      XIRR
                      <Info className="w-3 h-3 text-muted-foreground" />
                    </CardTitle>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Extended Internal Rate of Return - annualized return rate</p>
                  </TooltipContent>
                </Tooltip>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold text-success">{bondData.xirr.toFixed(2)}%</p>
                <p className="text-xs text-muted-foreground">Annualized</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-subtle border-primary/20">
              <CardHeader className="pb-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <CardTitle className="text-sm flex items-center gap-2 cursor-help">
                      <CalendarDays className="w-4 h-4 text-primary" />
                      Investment Date
                      <Info className="w-3 h-3 text-muted-foreground" />
                    </CardTitle>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Date when you invested in this bond</p>
                  </TooltipContent>
                </Tooltip>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{formatDate(bondData.dateOfInvestment)}</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-subtle border-primary/20">
              <CardHeader className="pb-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <CardTitle className="text-sm flex items-center gap-2 cursor-help">
                      <Clock className="w-4 h-4 text-warning" />
                      Maturity Date
                      <Info className="w-3 h-3 text-muted-foreground" />
                    </CardTitle>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Date when the bond will fully mature</p>
                  </TooltipContent>
                </Tooltip>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{formatDate(bondData.maturityDate)}</p>
                <Badge variant={bondData.matured ? "destructive" : "default"} className="text-xs mt-1">
                  {bondData.matured ? "Matured" : "Active"}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Payment Details - 3 column layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-subtle border-primary/20">
              <CardHeader>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <CardTitle className="text-lg flex items-center gap-2 cursor-help">
                      <Receipt className="w-5 h-5 text-primary" />
                      Payment Frequencies
                      <Info className="w-4 h-4 text-muted-foreground" />
                    </CardTitle>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>How frequently interest and principal payments are made</p>
                  </TooltipContent>
                </Tooltip>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Interest Frequency:</span>
                  <span className="font-semibold">{bondData.interestFrequency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Principal Frequency:</span>
                  <span className="font-semibold">{bondData.principalFrequency}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-subtle border-primary/20">
              <CardHeader>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <CardTitle className="text-lg flex items-center gap-2 cursor-help">
                      <TrendingUp className="w-5 h-5 text-success" />
                      Principal Status
                      <Info className="w-4 h-4 text-muted-foreground" />
                    </CardTitle>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Principal repayment status based on actual payments received</p>
                  </TooltipContent>
                </Tooltip>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Principal Repaid:</span>
                  <span className="font-semibold text-success">{formatCurrency(actualPrincipalRepaid)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Principal Remaining:</span>
                  <span className="font-semibold text-primary">{formatCurrency(principalRemaining)}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-subtle border-primary/20">
              <CardHeader>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <CardTitle className="text-lg flex items-center gap-2 cursor-help">
                      <Percent className="w-5 h-5 text-success" />
                      Interest Status
                      <Info className="w-4 h-4 text-muted-foreground" />
                    </CardTitle>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Interest payments received from repayment summary report</p>
                  </TooltipContent>
                </Tooltip>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Before TDS:</span>
                  <span className="font-semibold text-success">{formatCurrency(actualInterestPaidBeforeTDS)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">After TDS:</span>
                  <span className="font-semibold text-success">{formatCurrency(actualInterestPaidAfterTDS)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Missed Interest Payments Alert */}
          {missedInterestMonths.length > 0 && (
            <Card className="bg-destructive/10 border-destructive/30">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-destructive mb-2">Missed Interest Payments</h4>
                    <p className="text-sm text-muted-foreground">
                      Interest payment missed for {missedInterestMonths.join(', ')}.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Repayment Schedule */}
          <Card className="bg-gradient-subtle border-primary/20">
            <CardHeader>
              <Tooltip>
                <TooltipTrigger asChild>
                  <CardTitle className="text-lg flex items-center gap-2 cursor-help">
                    Repayment Schedule
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </CardTitle>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Detailed payment schedule showing actual and projected payments</p>
                </TooltipContent>
              </Tooltip>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">Payment Date</TableHead>
                    <TableHead className="font-semibold text-right">Principal Payment</TableHead>
                    <TableHead className="font-semibold text-right">Interest Payment</TableHead>
                    <TableHead className="font-semibold text-right">Total Payment</TableHead>
                    <TableHead className="font-semibold text-right">Principal Balance</TableHead>
                    <TableHead className="font-semibold text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repaymentSchedule.map((entry, index) => {
                    const hasBothPayments = entry.principalPayment > 0 && entry.interestPayment > 0;
                    return (
                      <TableRow key={index} className={`border-border ${hasBothPayments ? 'bg-primary/10 border-primary/20' : ''}`}>
                        <TableCell className="font-medium">{entry.date}</TableCell>
                        <TableCell className="text-right">{formatCurrency(entry.principalPayment)}</TableCell>
                        <TableCell className="text-right text-success">{formatCurrency(entry.interestPayment)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(entry.totalPayment)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatCurrency(entry.principalBalance)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={entry.status === 'Paid' ? 'default' : 'secondary'} className="text-xs">
                            {entry.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
    </TooltipProvider>
  );
};