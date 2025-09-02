import React, { useState, useMemo, useRef, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronDown, ChevronRight, Calendar, ArrowUpDown, ArrowUp, ArrowDown, Clock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    [bondName: string]: {
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
type ViewType = 'Investment' | 'Interest Paid' | 'Principal Paid' | 'Principal & Interest Paid';

export const BondAnalysisView: React.FC<BondAnalysisViewProps> = ({ pivotData, bondData, repaymentData }) => {
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('All Time');
  const [durationView, setDurationView] = useState<DurationView>('Months');
  const [expandedIssuers, setExpandedIssuers] = useState<Set<string>>(new Set());
  const [showChart, setShowChart] = useState<boolean>(false);
  const [sortField, setSortField] = useState<SortField>('issuer');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedBond, setSelectedBond] = useState<{ bondData: BondData | null; bondName: string; issuer: string } | null>(null);
  const [viewType, setViewType] = useState<ViewType>('Investment');
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

  const handleBondClick = (bondName: string, issuer: string) => {
    // Find the specific bond data
    const bondDataMatch = filteredData.find(bond => 
      bond.bondName === bondName && bond.bondIssuer === issuer
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

  // Generate filtered pivot data based on view type
  const filteredPivotData = useMemo(() => {
    const pivot: PivotData = {};
    
    if (viewType === 'Investment') {
      // Original investment view
      filteredData.forEach(bond => {
        if (!pivot[bond.bondIssuer]) {
          pivot[bond.bondIssuer] = {};
        }
        
        if (!pivot[bond.bondIssuer][bond.bondName]) {
          pivot[bond.bondIssuer][bond.bondName] = {};
        }
        
        const timeKey = durationView === 'Years' 
          ? new Date(bond.dateOfInvestment.split('/').reverse().join('-')).getFullYear().toString()
          : durationView === 'Quarters'
          ? `Q${Math.ceil((new Date(bond.dateOfInvestment.split('/').reverse().join('-')).getMonth() + 1) / 3)} ${new Date(bond.dateOfInvestment.split('/').reverse().join('-')).getFullYear()}`
          : bond.monthYear;
        
        if (!pivot[bond.bondIssuer][bond.bondName][timeKey]) {
          pivot[bond.bondIssuer][bond.bondName][timeKey] = 0;
        }
        
        pivot[bond.bondIssuer][bond.bondName][timeKey] += bond.investedAmount;
      });
    } else {
      // Repayment views
      repaymentData.forEach(repayment => {
        const bond = filteredData.find(b => b.bondName === repayment.bondName);
        if (!bond) return;
        
        if (!pivot[bond.bondIssuer]) {
          pivot[bond.bondIssuer] = {};
        }
        
        if (!pivot[bond.bondIssuer][repayment.bondName]) {
          pivot[bond.bondIssuer][repayment.bondName] = {};
        }
        
        const repaymentDate = new Date(repayment.date.split('/').reverse().join('-'));
        const timeKey = durationView === 'Years' 
          ? repaymentDate.getFullYear().toString()
          : durationView === 'Quarters'
          ? `Q${Math.ceil((repaymentDate.getMonth() + 1) / 3)} ${repaymentDate.getFullYear()}`
          : repaymentDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
        
        if (!pivot[bond.bondIssuer][repayment.bondName][timeKey]) {
          pivot[bond.bondIssuer][repayment.bondName][timeKey] = 0;
        }
        
        let amount = 0;
        switch (viewType) {
          case 'Interest Paid':
            amount = repayment.interestPaidAfterTDS;
            break;
          case 'Principal Paid':
            amount = repayment.principalRepaid;
            break;
          case 'Principal & Interest Paid':
            amount = repayment.principalRepaid + repayment.interestPaidAfterTDS;
            break;
        }
        
        pivot[bond.bondIssuer][repayment.bondName][timeKey] += amount;
      });
    }
    
    return pivot;
  }, [filteredData, durationView, viewType, repaymentData]);

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
              <div className="flex items-center gap-3">
                <Button
                  variant={showChart ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowChart(!showChart)}
                  className="text-xs h-8"
                >
                  {showChart ? "Hide Chart" : "Show Chart"}
                </Button>
                
                <Select value={viewType} onValueChange={(value: ViewType) => setViewType(value)}>
                  <SelectTrigger className="w-48 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Investment">Investment</SelectItem>
                    <SelectItem value="Interest Paid">Interest Paid</SelectItem>
                    <SelectItem value="Principal Paid">Principal Paid</SelectItem>
                    <SelectItem value="Principal & Interest Paid">Principal & Interest Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
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
                    <TableHead 
                      className="font-semibold text-right bg-muted border-r border-border cursor-pointer hover:bg-muted/80"
                      onClick={() => handleSort('investment')}
                    >
                      <div className="flex items-center justify-end space-x-2">
                        <span>{viewType}</span>
                        {sortField === 'investment' && (
                          sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                        )}
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-right bg-muted border-r border-border min-w-32">Principal Remaining</TableHead>
                    <TableHead className="font-semibold text-right bg-muted border-r border-border min-w-32">Interest Paid</TableHead>
                    <TableHead className="font-semibold text-center bg-muted border-r border-border min-w-20">Bonds</TableHead>
                    {allTimePeriods.map(period => (
                      <TableHead key={period} className="font-semibold text-right min-w-24 bg-muted">
                        {period}
                      </TableHead>
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
                    const activeBondsCount = filteredData.filter(bond => bond.bondIssuer === issuer).length;
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
                              </div>
                           </TableCell>
                           <TableCell className="text-right font-semibold text-primary">
                              {formatCurrency(issuerTotals[issuer])}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-primary">
                              {formatCurrency(filteredData.filter(bond => bond.bondIssuer === issuer).reduce((sum, bond) => {
                                const bondRepayments = repaymentData.filter(r => r.bondName === bond.bondName || r.isin === bond.isin);
                                const principalRepaid = bondRepayments.reduce((pSum, r) => pSum + r.principalRepaid, 0);
                                return sum + Math.max(0, bond.investedAmount - principalRepaid);
                              }, 0))}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-success">
                              {formatCurrency(filteredData.filter(bond => bond.bondIssuer === issuer).reduce((sum, bond) => {
                                const bondRepayments = repaymentData.filter(r => r.bondName === bond.bondName || r.isin === bond.isin);
                                return sum + bondRepayments.reduce((iSum, r) => iSum + r.interestPaidAfterTDS, 0);
                              }, 0))}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary" className="bg-success-glow text-success text-xs">
                                {activeBondsCount}
                              </Badge>
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
                        {isExpanded && Object.entries(bonds).map(([bondName, timeData]) => (
                          <TableRow 
                            key={bondName} 
                            className="border-border bg-background/50 hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => handleBondClick(bondName, issuer)}
                          >
                             <TableCell className="sticky left-0 bg-background z-20 pl-8 border-r border-border">
                               <div className="flex items-center space-x-2">
                                 <Calendar className="w-3 h-3 text-muted-foreground" />
                                 <span className="text-sm hover:text-primary transition-colors">{bondName}</span>
                                 {filteredData.some(bond => bond.bondName === bondName && bond.bondIssuer === issuer && isNearMaturity(bond.maturityDate)) && (
                                   <UITooltip>
                                     <TooltipTrigger asChild>
                                       <Clock className="w-4 h-4 text-warning animate-pulse" />
                                     </TooltipTrigger>
                                     <TooltipContent>
                                       <p>Matures within 30 days</p>
                                     </TooltipContent>
                                   </UITooltip>
                                 )}
                               </div>
                             </TableCell>
                              <TableCell className="text-right text-sm">
                                {formatCurrency(Object.values(timeData).reduce((sum, amount) => sum + amount, 0))}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {(() => {
                                  const bondDetails = filteredData.find(bond => bond.bondName === bondName && bond.bondIssuer === issuer);
                                  if (!bondDetails) return '-';
                                  const bondRepayments = repaymentData.filter(r => r.bondName === bondName || r.isin === bondDetails.isin);
                                  const principalRepaid = bondRepayments.reduce((sum, r) => sum + r.principalRepaid, 0);
                                  const remaining = Math.max(0, bondDetails.investedAmount - principalRepaid);
                                  return formatCurrency(remaining);
                                })()}
                              </TableCell>
                              <TableCell className="text-right text-sm text-success">
                                {(() => {
                                  const bondDetails = filteredData.find(bond => bond.bondName === bondName && bond.bondIssuer === issuer);  
                                  if (!bondDetails) return '-';
                                  const bondRepayments = repaymentData.filter(r => r.bondName === bondName || r.isin === bondDetails.isin);
                                  const interestRepaid = bondRepayments.reduce((sum, r) => sum + r.interestPaidAfterTDS, 0);
                                  return formatCurrency(interestRepaid);
                                })()}
                              </TableCell>
                              <TableCell className="text-center text-sm">-</TableCell>
                             {allTimePeriods.map(period => (
                               <TableCell key={period} className="text-right text-sm">
                                 {timeData[period] ? formatCurrency(timeData[period]) : '-'}
                               </TableCell>
                             ))}
                          </TableRow>
                        ))}
                      </React.Fragment>
                     );
                   })}
                   
                   {/* Total Row */}
                   <TableRow className="border-border bg-muted font-bold">
                     <TableCell className="sticky left-0 bg-muted z-20 border-r border-border font-bold">
                       Total
                     </TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {formatCurrency(Object.values(issuerTotals).reduce((sum, amount) => sum + amount, 0))}
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {formatCurrency(filteredData.reduce((sum, bond) => {
                          const bondRepayments = repaymentData.filter(r => r.bondName === bond.bondName || r.isin === bond.isin);
                          const principalRepaid = bondRepayments.reduce((pSum, r) => pSum + r.principalRepaid, 0);
                          return sum + Math.max(0, bond.investedAmount - principalRepaid);
                        }, 0))}
                      </TableCell>
                      <TableCell className="text-right font-bold text-success">
                        {formatCurrency(filteredData.reduce((sum, bond) => {
                          const bondRepayments = repaymentData.filter(r => r.bondName === bond.bondName || r.isin === bond.isin);
                          return sum + bondRepayments.reduce((iSum, r) => iSum + r.interestPaidAfterTDS, 0);
                        }, 0))}
                      </TableCell>
                      <TableCell className="text-center font-bold">
                        {filteredData.length}
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
        />
      </CardContent>
    </Card>
  );
};