import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronDown, ChevronRight, Calendar, ArrowUpDown, ArrowUp, ArrowDown, Clock, AlertTriangle } from 'lucide-react';
import { BondDetailsModal } from './BondDetailsModal';

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

interface PivotData {
  [issuer: string]: {
    [bondKey: string]: { // bondKey = bondName + "|" + isin
      [monthYear: string]: number;
    };
  };
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

interface BondAnalysisViewProps {
  pivotData: PivotData;
  bondData: BondData[];
  repaymentData: RepaymentData[];
}

type DurationFilter = 'This Year' | 'Last Year' | 'All Time';
type DurationView = 'Years' | 'Quarters' | 'Months';

type SortField = 'issuer' | 'investment';
type SortDirection = 'asc' | 'desc';

export const BondAnalysisView: React.FC<BondAnalysisViewProps> = ({ pivotData, bondData, repaymentData }) => {
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('All Time');
  const [durationView, setDurationView] = useState<DurationView>('Months');
  const [expandedIssuers, setExpandedIssuers] = useState<Set<string>>(new Set());
  const [showChart, setShowChart] = useState<boolean>(false);
  const [sortField, setSortField] = useState<SortField>('issuer');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedBond, setSelectedBond] = useState<{ bondData: BondData | null; bondName: string; issuer: string } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Reset scroll to top when duration filter or view changes
  useEffect(() => {
    if (tableRef.current) {
      tableRef.current.scrollTop = 0;
    }
  }, [durationFilter, durationView]);

  const toggleIssuer = (issuer: string) => {
    const newExpanded = new Set(expandedIssuers);
    if (newExpanded.has(issuer)) {
      newExpanded.delete(issuer);
    } else {
      newExpanded.add(issuer);
    }
    setExpandedIssuers(newExpanded);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleBondClick = (bondKey: string, issuer: string) => {
    // Extract bondName and ISIN from bondKey
    const [bondName, isin] = bondKey.split('|');
    
    // Find the specific bond data using both bondName and ISIN
    const bondDataMatch = filteredData.find(bond => 
      bond.bondName === bondName && bond.isin === isin && bond.bondIssuer === issuer
    );
    
    setSelectedBond({
      bondData: bondDataMatch || null,
      bondName,
      issuer
    });
  };

  // Check if bond is near maturity (within 30 days)
  const isNearMaturity = (maturityDate: string): boolean => {
    const maturity = new Date(maturityDate.split('/').reverse().join('-'));
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000));
    return maturity <= thirtyDaysFromNow && maturity > today;
  };

  // Check if any bond in issuer is near maturity
  const issuerHasNearMaturity = (issuer: string): boolean => {
    return filteredData.some(bond => bond.bondIssuer === issuer && isNearMaturity(bond.maturityDate));
  };

  // Calculate missed interest payments for monthly bonds
  const getMissedInterestMonths = (bond: BondData): string[] => {
    if (bond.interestFrequency !== 'Monthly') return [];
    
    const investmentDate = new Date(bond.dateOfInvestment.split('/').reverse().join('-'));
    const currentDate = new Date();
    const maturityDate = new Date(bond.maturityDate.split('/').reverse().join('-'));
    
    // Interest payments start from the next month after investment
    const startDate = new Date(investmentDate.getFullYear(), investmentDate.getMonth() + 1, 1);
    const endDate = currentDate < maturityDate ? currentDate : maturityDate;
    
    const expectedMonths: string[] = [];
    const currentMonth = new Date(startDate);
    
    while (currentMonth <= endDate) {
      expectedMonths.push(`${String(currentMonth.getDate()).padStart(2, '0')}/${String(currentMonth.getMonth() + 1).padStart(2, '0')}/${currentMonth.getFullYear()}`);
      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }
    
    // Get actual interest payment months for this bond
    const bondRepayments = repaymentData.filter(entry => 
      entry.bondName === bond.bondName && entry.isin === bond.isin && entry.interestPaidBeforeTDS > 0
    );
    
    const actualPaymentMonths = bondRepayments.map(entry => {
      const date = new Date(entry.date.split('/').reverse().join('-'));
      return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
    });
    
    // Find missed months (exclude current month)
    return expectedMonths.filter(month => {
      const monthDate = new Date(month.split('/').reverse().join('-'));
      const isCurrentMonth = monthDate.getMonth() === currentDate.getMonth() && monthDate.getFullYear() === currentDate.getFullYear();
      return monthDate < currentDate && !isCurrentMonth && !actualPaymentMonths.some(paymentMonth => {
        const paymentDate = new Date(paymentMonth.split('/').reverse().join('-'));
        return paymentDate.getMonth() === monthDate.getMonth() && paymentDate.getFullYear() === monthDate.getFullYear();
      });
    });
  };

  // Check if bond series has missed interest payments
  const hasMissedInterestPayments = (bondKey: string, issuer: string): string[] => {
    const [bondName, isin] = bondKey.split('|');
    const bond = filteredData.find(b => b.bondName === bondName && b.isin === isin && b.bondIssuer === issuer);
    return bond ? getMissedInterestMonths(bond) : [];
  };

  // Check if any bond in issuer has missed interest payments
  const issuerHasMissedPayments = (issuer: string): string[] => {
    const issuerBonds = filteredData.filter(bond => bond.bondIssuer === issuer);
    const allMissedMonths: string[] = [];
    
    issuerBonds.forEach(bond => {
      const missedMonths = getMissedInterestMonths(bond);
      allMissedMonths.push(...missedMonths);
    });
    
    return [...new Set(allMissedMonths)]; // Remove duplicates
  };

  const formatCurrency = (amount: number): string => {
    return `₹${amount.toLocaleString('en-IN', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  // Filter data based on duration filter
  const filteredData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const lastYear = currentYear - 1;

    return bondData.filter(bond => {
      if (bond.matured) return false; // Only active bonds
      
      const investmentDate = new Date(bond.dateOfInvestment.split('/').reverse().join('-'));
      const investmentYear = investmentDate.getFullYear();

      switch (durationFilter) {
        case 'This Year':
          return investmentYear === currentYear;
        case 'Last Year':
          return investmentYear === lastYear;
        case 'All Time':
        default:
          return true;
      }
    });
  }, [bondData, durationFilter]);

  // Generate filtered pivot data
  const filteredPivotData = useMemo(() => {
    const pivot: PivotData = {};
    
    filteredData.forEach(bond => {
      if (!pivot[bond.bondIssuer]) {
        pivot[bond.bondIssuer] = {};
      }
      
      // Create unique bond key using bondName + ISIN
      const bondKey = `${bond.bondName}|${bond.isin}`;
      
      if (!pivot[bond.bondIssuer][bondKey]) {
        pivot[bond.bondIssuer][bondKey] = {};
      }
      
      const timeKey = durationView === 'Years' 
        ? new Date(bond.dateOfInvestment.split('/').reverse().join('-')).getFullYear().toString()
        : durationView === 'Quarters'
        ? `Q${Math.ceil((new Date(bond.dateOfInvestment.split('/').reverse().join('-')).getMonth() + 1) / 3)} ${new Date(bond.dateOfInvestment.split('/').reverse().join('-')).getFullYear()}`
        : bond.monthYear;
      
      if (!pivot[bond.bondIssuer][bondKey][timeKey]) {
        pivot[bond.bondIssuer][bondKey][timeKey] = 0;
      }
      
      pivot[bond.bondIssuer][bondKey][timeKey] += bond.investedAmount;
    });
    
    return pivot;
  }, [filteredData, durationView]);

  // Get all unique time periods for column headers
  const allTimePeriods = useMemo(() => {
    const periods = new Set<string>();
    Object.values(filteredPivotData).forEach(bonds => {
      Object.values(bonds).forEach(timeData => {
        Object.keys(timeData).forEach(period => {
          periods.add(period);
        });
      });
    });
    return Array.from(periods).sort((a, b) => {
      if (durationView === 'Years') {
        return parseInt(a) - parseInt(b);
      } else if (durationView === 'Quarters') {
        // Parse quarters like "Q1 2023", "Q2 2023" etc.
        const parseQuarter = (quarter: string) => {
          const [q, year] = quarter.split(' ');
          const quarterNum = parseInt(q.replace('Q', ''));
          return parseInt(year) * 4 + quarterNum;
        };
        return parseQuarter(a) - parseQuarter(b);
      } else {
        // For months, parse the date string
        const dateA = new Date(a);
        const dateB = new Date(b);
        return dateA.getTime() - dateB.getTime();
      }
    });
  }, [filteredPivotData, durationView]);

  // Calculate issuer totals
  const issuerTotals = useMemo(() => {
    const totals: { [issuer: string]: number } = {};
    Object.entries(filteredPivotData).forEach(([issuer, bonds]) => {
      let total = 0;
      Object.values(bonds).forEach(timeData => {
        Object.values(timeData).forEach(amount => {
          total += amount;
        });
      });
      totals[issuer] = total;
    });
    return totals;
  }, [filteredPivotData]);

  // Calculate average XIRR for filtered active bonds only
  const avgXirr = useMemo(() => {
    if (filteredData.length === 0) return 0;
    return filteredData.reduce((sum, bond) => sum + bond.xirr, 0) / filteredData.length;
  }, [filteredData]);

  // Calculate average investment per period for chart line
  const avgInvestment = useMemo(() => {
    const totalInvestment = Object.values(issuerTotals).reduce((sum, amount) => sum + amount, 0);
    return totalInvestment / allTimePeriods.length;
  }, [issuerTotals, allTimePeriods]);

  // Chart data
  const chartData = useMemo(() => {
    const timeData: { [period: string]: number } = {};
    const issuerColors: { [issuer: string]: string } = {};
    
    const colors = [
      'hsl(180, 100%, 35%)',
      'hsl(160, 60%, 45%)',
      'hsl(140, 70%, 40%)',
      'hsl(45, 90%, 55%)',
      'hsl(260, 60%, 50%)',
      'hsl(340, 70%, 50%)',
      'hsl(20, 80%, 55%)',
      'hsl(200, 70%, 45%)',
    ];
    
    let colorIndex = 0;
    
    Object.entries(filteredPivotData).forEach(([issuer, bonds]) => {
      issuerColors[issuer] = colors[colorIndex % colors.length];
      colorIndex++;
      
      Object.values(bonds).forEach(timeDataBond => {
        Object.entries(timeDataBond).forEach(([period, amount]) => {
          if (!timeData[period]) {
            timeData[period] = 0;
          }
          timeData[period] += amount;
        });
      });
    });
    
    return {
      data: allTimePeriods.map(period => {
        const entry: any = { period };
        
        Object.entries(filteredPivotData).forEach(([issuer, bonds]) => {
          let issuerTotal = 0;
          Object.values(bonds).forEach(timeDataBond => {
            if (timeDataBond[period]) {
              issuerTotal += timeDataBond[period];
            }
          });
          if (issuerTotal > 0) {
            entry[issuer] = issuerTotal;
          }
        });
        
        return entry;
      }),
      colors: issuerColors
    };
  }, [filteredPivotData, allTimePeriods]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card p-3 rounded-lg shadow-medium border">
          <p className="font-semibold mb-2">{label}</p>
           {payload.map((entry: any, index: number) => (
             <p key={index} style={{ color: entry.color }} className="text-sm">
               {entry.dataKey}: {formatCurrency(entry.value)}
             </p>
           ))}
           <p className="text-sm font-semibold mt-2 pt-2 border-t">
             Total: {formatCurrency(payload.reduce((sum: number, entry: any) => sum + entry.value, 0))}
           </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="shadow-medium bg-gradient-card border-0">
      <CardHeader>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-bold">Active Investment Analysis</CardTitle>
            <CardDescription>
              (excludes matured bonds)
            </CardDescription>
          </div>
          
          {/* Duration Filters and KPIs */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant={showChart ? "default" : "outline"}
                size="sm"
                onClick={() => setShowChart(!showChart)}
                className="text-xs h-8"
              >
                {showChart ? "Hide Chart" : "Show Chart"}
              </Button>
              
              <div className="flex bg-muted rounded-lg p-1 h-8">
                {(['This Year', 'Last Year', 'All Time'] as DurationFilter[]).map((filter) => (
                  <Button
                    key={filter}
                    variant={durationFilter === filter ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setDurationFilter(filter)}
                    className="text-xs h-6"
                  >
                    {filter}
                  </Button>
                ))}
              </div>
              
              <div className="flex bg-muted rounded-lg p-1 h-8">
                {(['Years', 'Quarters', 'Months'] as DurationView[]).map((view) => (
                  <Button
                    key={view}
                    variant={durationView === view ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setDurationView(view)}
                    className="text-xs h-6"
                  >
                    {view}
                  </Button>
                ))}
              </div>
            </div>
            
            <TooltipProvider>
              <UITooltip>
                <TooltipTrigger asChild>
                  <div className="bg-primary-glow/20 px-3 py-1 rounded-lg cursor-help">
                    <span className="text-sm text-muted-foreground mr-2">Avg XIRR:</span>
                    <span className="font-semibold text-primary">{avgXirr.toFixed(2)}%</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Average XIRR of bonds shown in the current table view</p>
                </TooltipContent>
              </UITooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Chart */}
        {showChart && (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData.data}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 60,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="period" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  fontSize={12}
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis 
                  tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}K`}
                  fontSize={12}
                  stroke="hsl(var(--muted-foreground))"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="rect"
                />
                
                
                {Object.keys(chartData.colors).map((issuer) => (
                  <Bar
                    key={issuer}
                    dataKey={issuer}
                    stackId="investment"
                    fill={chartData.colors[issuer]}
                    radius={[2, 2, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        
        {/* Table */}
          <div className="relative">
          
          <div className="border rounded-lg overflow-hidden">
            <div ref={tableRef} className="overflow-auto max-h-96 relative">
              <Table>
                <TableHeader className="sticky top-0 z-30 bg-muted">
                  <TableRow className="border-border bg-muted">
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <TableHead 
                          className="font-semibold sticky left-0 top-0 bg-muted z-40 min-w-48 border-r border-border cursor-pointer hover:bg-muted/80"
                          onClick={() => handleSort('issuer')}
                        >
                          <div className="flex items-center space-x-2">
                            <span>Bond Issuer</span>
                            {sortField === 'issuer' && (
                              sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                            )}
                          </div>
                        </TableHead>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Name of the organization that issued the bond</p>
                      </TooltipContent>
                    </UITooltip>
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <TableHead className="font-semibold text-center bg-muted border-r border-border min-w-12">
                          #
                        </TableHead>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Number of unique bond series from this issuer</p>
                      </TooltipContent>
                    </UITooltip>
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <TableHead 
                          className="font-semibold text-right bg-muted border-r border-border cursor-pointer hover:bg-muted/80"
                          onClick={() => handleSort('investment')}
                        >
                          <div className="flex items-center justify-end space-x-2">
                            <span>Investment</span>
                            {sortField === 'investment' && (
                              sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                            )}
                          </div>
                        </TableHead>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Total amount invested in bonds from this issuer</p>
                      </TooltipContent>
                    </UITooltip>
                     <UITooltip>
                       <TooltipTrigger asChild>
                         <TableHead className="font-semibold text-right bg-muted border-r border-border min-w-32">Principal Remaining</TableHead>
                       </TooltipTrigger>
                       <TooltipContent>
                         <p>Outstanding principal amount yet to be repaid</p>
                       </TooltipContent>
                     </UITooltip>
                     <UITooltip>
                       <TooltipTrigger asChild>
                         <TableHead className="font-semibold text-right bg-muted border-r border-border min-w-32">Interest Paid</TableHead>
                       </TooltipTrigger>
                       <TooltipContent>
                         <p>Total interest received after tax deduction</p>
                       </TooltipContent>
                     </UITooltip>
                    {allTimePeriods.map(period => (
                      <UITooltip key={period}>
                        <TooltipTrigger asChild>
                          <TableHead className="font-semibold text-right min-w-24 bg-muted">
                            {period}
                          </TableHead>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Investment amount for {period}</p>
                        </TooltipContent>
                      </UITooltip>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(filteredPivotData).sort((a, b) => {
                    if (sortField === 'issuer') {
                      return sortDirection === 'asc' 
                        ? a[0].localeCompare(b[0]) 
                        : b[0].localeCompare(a[0]);
                    } else {
                      return sortDirection === 'asc' 
                        ? issuerTotals[a[0]] - issuerTotals[b[0]] 
                        : issuerTotals[b[0]] - issuerTotals[a[0]];
                    }
                  }).map(([issuer, bonds]) => {
                     const uniqueBondSeriesCount = Object.keys(bonds).length; // Count unique bond series (bondName|ISIN combinations)
                     const isExpanded = expandedIssuers.has(issuer);
                    
                    return (
                      <React.Fragment key={issuer}>
                        {/* Issuer Row */}
                        <TableRow className="border-border bg-muted/30 hover:bg-muted/50 cursor-pointer" onClick={() => toggleIssuer(issuer)}>
                           <TableCell className="sticky left-0 bg-muted z-20 border-r border-border">
                              <div className="flex items-center space-x-2">
                                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                  <span className="font-semibold text-primary">{issuer}</span>
                                  {issuerHasNearMaturity(issuer) && (
                                    <UITooltip>
                                      <TooltipTrigger asChild>
                                        <Clock className="w-4 h-4 text-warning animate-pulse" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Has bonds maturing within 30 days</p>
                                      </TooltipContent>
                                    </UITooltip>
                                  )}
                                  {issuerHasMissedPayments(issuer).length > 0 && (
                                    <UITooltip>
                                      <TooltipTrigger asChild>
                                        <AlertTriangle className="w-4 h-4 text-destructive" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Interest payment missed for {issuerHasMissedPayments(issuer).length} months</p>
                                      </TooltipContent>
                                    </UITooltip>
                                  )}
                                </div>
                           </TableCell>
                           <TableCell className="text-center font-semibold">
                             {uniqueBondSeriesCount}
                           </TableCell>
                           <TableCell className="text-right font-semibold text-primary">
                              {formatCurrency(issuerTotals[issuer])}
                            </TableCell>
                             <TableCell className="text-right font-semibold text-primary">
                                {(() => {
                                  // Group bonds by bondName + ISIN to handle multiple entries for same series
                                  const bondSeries = new Map<string, { totalInvestment: number; repayments: RepaymentData[] }>();
                                  
                                  filteredData.filter(bond => bond.bondIssuer === issuer).forEach(bond => {
                                    const bondKey = `${bond.bondName}|${bond.isin}`;
                                    if (!bondSeries.has(bondKey)) {
                                      bondSeries.set(bondKey, { totalInvestment: 0, repayments: repaymentData.filter(r => r.bondName === bond.bondName && r.isin === bond.isin) });
                                    }
                                    bondSeries.get(bondKey)!.totalInvestment += bond.investedAmount;
                                  });
                                  
                                  let totalRemaining = 0;
                                  bondSeries.forEach(({ totalInvestment, repayments }) => {
                                    const principalRepaid = repayments.reduce((sum, r) => sum + r.principalRepaid, 0);
                                    totalRemaining += Math.max(0, totalInvestment - principalRepaid);
                                  });
                                  
                                  return formatCurrency(totalRemaining);
                                })()}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-success">
                                {(() => {
                                  // Group bonds by bondName + ISIN to get unique bond series for this issuer
                                  const bondSeries = new Map<string, RepaymentData[]>();
                                  
                                  filteredData.filter(bond => bond.bondIssuer === issuer).forEach(bond => {
                                    const bondKey = `${bond.bondName}|${bond.isin}`;
                                    if (!bondSeries.has(bondKey)) {
                                      bondSeries.set(bondKey, repaymentData.filter(r => r.bondName === bond.bondName && r.isin === bond.isin));
                                    }
                                  });
                                  
                                  let totalInterestPaid = 0;
                                  bondSeries.forEach((repayments) => {
                                    totalInterestPaid += repayments.reduce((sum, r) => sum + r.interestPaidAfterTDS, 0);
                                  });
                                  
                                  return formatCurrency(totalInterestPaid);
                                })()}
                              </TableCell>
                           {allTimePeriods.map(period => {
                            const total = Object.values(bonds).reduce((sum, timeData) => {
                              return sum + (timeData[period] || 0);
                            }, 0);
                             return (
                               <TableCell key={period} className="text-right font-medium">
                                 {total > 0 ? formatCurrency(total) : '-'}
                               </TableCell>
                             );
                          })}
                        </TableRow>
                        
                        {/* Bond Series Rows */}
                        {isExpanded && Object.entries(bonds).map(([bondKey, timeData]) => {
                          const [bondName, isin] = bondKey.split('|');
                          return (
                          <TableRow 
                            key={bondKey} 
                            className="border-border bg-background/50 hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => handleBondClick(bondKey, issuer)}
                          >
                             <TableCell className="sticky left-0 bg-background z-20 pl-8 border-r border-border">
                                <div className="flex items-center space-x-2">
                                  <Calendar className="w-3 h-3 text-muted-foreground" />
                                  <span className="text-sm hover:text-primary transition-colors">{bondName}</span>
                                  {filteredData.some(bond => bond.bondName === bondName && bond.isin === isin && bond.bondIssuer === issuer && isNearMaturity(bond.maturityDate)) && (
                                    <UITooltip>
                                      <TooltipTrigger asChild>
                                        <Clock className="w-4 h-4 text-warning animate-pulse" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Matures within 30 days</p>
                                      </TooltipContent>
                                    </UITooltip>
                                  )}
                                  {hasMissedInterestPayments(bondKey, issuer).length > 0 && (
                                    <UITooltip>
                                      <TooltipTrigger asChild>
                                        <AlertTriangle className="w-4 h-4 text-destructive" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Interest payment missed for {hasMissedInterestPayments(bondKey, issuer).length} months</p>
                                      </TooltipContent>
                                    </UITooltip>
                                  )}
                                </div>
                             </TableCell>
                             <TableCell className="text-center text-sm">
                               -
                             </TableCell>
                              <TableCell className="text-right text-sm">
                                {formatCurrency(Object.values(timeData).reduce((sum, amount) => sum + amount, 0))}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                 {(() => {
                                   // Aggregate all investments for this bond series (bondName + ISIN)
                                   const bondInvestments = filteredData.filter(bond => 
                                     bond.bondName === bondName && bond.isin === isin && bond.bondIssuer === issuer
                                   );
                                   if (bondInvestments.length === 0) return '-';
                                   
                                   const totalInvestment = bondInvestments.reduce((sum, bond) => sum + bond.investedAmount, 0);
                                   const bondRepayments = repaymentData.filter(r => r.bondName === bondName && r.isin === isin);
                                   const principalRepaid = bondRepayments.reduce((sum, r) => sum + r.principalRepaid, 0);
                                   const remaining = Math.max(0, totalInvestment - principalRepaid);
                                   return formatCurrency(remaining);
                                 })()}
                               </TableCell>
                               <TableCell className="text-right text-sm text-success">
                                 {(() => {
                                   const bondDetails = filteredData.find(bond => bond.bondName === bondName && bond.isin === isin && bond.bondIssuer === issuer);  
                                   if (!bondDetails) return '-';
                                   const bondRepayments = repaymentData.filter(r => r.bondName === bondName && r.isin === isin);
                                   const interestRepaid = bondRepayments.reduce((sum, r) => sum + r.interestPaidAfterTDS, 0);
                                   return formatCurrency(interestRepaid);
                                 })()}
                               </TableCell>
                             {allTimePeriods.map(period => (
                               <TableCell key={period} className="text-right text-sm">
                                 {timeData[period] ? formatCurrency(timeData[period]) : '-'}
                               </TableCell>
                             ))}
                          </TableRow>
                          );
                        })}
                      </React.Fragment>
                     );
                   })}
                   
                    {/* Total Row */}
                    <TableRow className="border-border bg-muted font-bold">
                      <TableCell className="sticky left-0 bg-muted z-20 border-r border-border font-bold">
                        Total
                      </TableCell>
                      <TableCell className="text-center font-bold">
                        -
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {formatCurrency(Object.values(issuerTotals).reduce((sum, amount) => sum + amount, 0))}
                      </TableCell>
                        <TableCell className="text-right font-bold text-primary">
                          {(() => {
                            // Group all bonds by bondName + ISIN to handle multiple entries for same series
                            const bondSeries = new Map<string, { totalInvestment: number; repayments: RepaymentData[] }>();
                            
                            filteredData.forEach(bond => {
                              const bondKey = `${bond.bondName}|${bond.isin}`;
                              if (!bondSeries.has(bondKey)) {
                                bondSeries.set(bondKey, { totalInvestment: 0, repayments: repaymentData.filter(r => r.bondName === bond.bondName && r.isin === bond.isin) });
                              }
                              bondSeries.get(bondKey)!.totalInvestment += bond.investedAmount;
                            });
                            
                            let totalRemaining = 0;
                            bondSeries.forEach(({ totalInvestment, repayments }) => {
                              const principalRepaid = repayments.reduce((sum, r) => sum + r.principalRepaid, 0);
                              totalRemaining += Math.max(0, totalInvestment - principalRepaid);
                            });
                            
                            return formatCurrency(totalRemaining);
                          })()}
                        </TableCell>
                         <TableCell className="text-right font-bold text-success">
                           {(() => {
                             // Group all bonds by bondName + ISIN to get unique bond series
                             const bondSeries = new Map<string, RepaymentData[]>();
                             
                             filteredData.forEach(bond => {
                               const bondKey = `${bond.bondName}|${bond.isin}`;
                               if (!bondSeries.has(bondKey)) {
                                 bondSeries.set(bondKey, repaymentData.filter(r => r.bondName === bond.bondName && r.isin === bond.isin));
                               }
                             });
                             
                             let totalInterestPaid = 0;
                             bondSeries.forEach((repayments) => {
                               totalInterestPaid += repayments.reduce((sum, r) => sum + r.interestPaidAfterTDS, 0);
                             });
                             
                             return formatCurrency(totalInterestPaid);
                           })()}
                         </TableCell>
                     {allTimePeriods.map(period => {
                       const periodTotal = Object.values(filteredPivotData).reduce((sum, bonds) => {
                         return sum + Object.values(bonds).reduce((bondSum, timeData) => {
                           return bondSum + (timeData[period] || 0);
                         }, 0);
                       }, 0);
                       return (
                         <TableCell key={period} className="text-right font-bold">
                           {periodTotal > 0 ? formatCurrency(periodTotal) : '-'}
                         </TableCell>
                       );
                     })}
                   </TableRow>
                 </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* Bond Details Modal */}
        <BondDetailsModal
          isOpen={selectedBond !== null}
          onClose={() => setSelectedBond(null)}
          bondData={selectedBond?.bondData || null}
          bondName={selectedBond?.bondName || ''}
          issuer={selectedBond?.issuer || ''}
          repaymentData={repaymentData}
          allBondData={filteredData}
        />
      </CardContent>
    </Card>
  );
};