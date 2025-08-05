import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, TrendingUp, Percent, Clock, Banknote, Receipt } from 'lucide-react';

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
}

export const BondDetailsModal: React.FC<BondDetailsModalProps> = ({
  isOpen,
  onClose,
  bondData,
  bondName,
  issuer,
  repaymentData
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

  // Filter repayment data for this specific bond
  const bondRepaymentData = repaymentData.filter(entry => 
    entry.bondName === bondName || entry.isin === bondData?.isin
  );

  // Calculate actual payments from repayment data
  const actualPrincipalRepaid = bondRepaymentData.reduce((sum, entry) => sum + entry.principalRepaid, 0);
  const actualInterestPaidBeforeTDS = bondRepaymentData.reduce((sum, entry) => sum + entry.interestPaidBeforeTDS, 0);
  const actualInterestPaidAfterTDS = bondRepaymentData.reduce((sum, entry) => sum + entry.interestPaidAfterTDS, 0);

  // Generate repayment schedule with status
  const generateRepaymentSchedule = (): (RepaymentScheduleEntry & { status: 'Paid' | 'Yet To Be Paid' })[] => {
    if (!bondData) return [];
    
    const schedule: (RepaymentScheduleEntry & { status: 'Paid' | 'Yet To Be Paid' })[] = [];
    const startDate = new Date(bondData.dateOfInvestment.split('/').reverse().join('-'));
    const endDate = new Date(bondData.maturityDate.split('/').reverse().join('-'));
    const monthsDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    
    const monthlyInterest = (bondData.investedAmount * (bondData.xirr / 100)) / 12;
    const principalPerMonth = bondData.investedAmount / Math.max(1, monthsDiff);
    
    let remainingPrincipal = bondData.investedAmount;
    
    for (let i = 1; i <= Math.ceil(monthsDiff); i++) {
      const paymentDate = new Date(startDate);
      paymentDate.setMonth(paymentDate.getMonth() + i);
      
      const principalPayment = Math.min(principalPerMonth, remainingPrincipal);
      remainingPrincipal -= principalPayment;
      
      // Check if this payment has been made based on repayment data
      const paymentDateStr = paymentDate.toLocaleDateString('en-IN');
      const isPaid = bondRepaymentData.some(entry => {
        // Parse DD/MM/YYYY format from repayment data
        const [day, month, year] = entry.date.split('/');
        const entryDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return Math.abs(entryDate.getTime() - paymentDate.getTime()) < 45 * 24 * 60 * 60 * 1000; // Within 45 days
      });
      
      schedule.push({
        date: paymentDateStr,
        principalPayment,
        interestPayment: monthlyInterest,
        principalBalance: remainingPrincipal,
        totalPayment: principalPayment + monthlyInterest,
        status: isPaid ? 'Paid' : 'Yet To Be Paid'
      });
      
      if (remainingPrincipal <= 0) break;
    }
    
    return schedule;
  };

  const repaymentSchedule = generateRepaymentSchedule();
  const principalRemaining = bondData ? bondData.investedAmount - actualPrincipalRepaid : 0;
  
  // Calculate future interest projections
  const futureInterestPayments = repaymentSchedule
    .filter(entry => entry.status === 'Yet To Be Paid')
    .reduce((sum, entry) => sum + entry.interestPayment, 0);

  if (!bondData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-card border-0">
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
                <CardTitle className="text-sm flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-primary" />
                  Principal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold text-primary">{formatCurrency(bondData.investedAmount)}</p>
                <p className="text-xs text-muted-foreground">{bondData.units} units</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-subtle border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Percent className="w-4 h-4 text-success" />
                  XIRR
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold text-success">{bondData.xirr.toFixed(2)}%</p>
                <p className="text-xs text-muted-foreground">Annualized</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-subtle border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary" />
                  Investment Date
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{formatDate(bondData.dateOfInvestment)}</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-subtle border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-warning" />
                  Maturity Date
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{formatDate(bondData.maturityDate)}</p>
                <Badge variant={bondData.matured ? "destructive" : "default"} className="text-xs mt-1">
                  {bondData.matured ? "Matured" : "Active"}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Payment Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-gradient-subtle border-primary/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-primary" />
                  Payment Frequencies
                </CardTitle>
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
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-success" />
                  Principal Status
                </CardTitle>
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
          </div>

          {/* Interest Status */}
          <Card className="bg-gradient-subtle border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Percent className="w-5 h-5 text-success" />
                Interest Status
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3 text-primary">Paid So Far</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">Before TDS:</span>
                    <span className="font-semibold text-success">{formatCurrency(actualInterestPaidBeforeTDS)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">After TDS:</span>
                    <span className="font-semibold text-success">{formatCurrency(actualInterestPaidAfterTDS)}</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-3 text-warning">Future Payment</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">Projected:</span>
                    <span className="font-semibold text-warning">{formatCurrency(futureInterestPayments)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    <p>* Based on projected schedule</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Repayment Schedule */}
          <Card className="bg-gradient-subtle border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">Repayment Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-80 overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted z-10">
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
                    {repaymentSchedule.map((entry, index) => (
                      <TableRow key={index} className="border-border">
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
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};