import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, TrendingUp, Calendar, AlertCircle } from 'lucide-react';

interface PivotData {
  [issuer: string]: {
    [bondName: string]: {
      [monthYear: string]: number;
    };
  };
}

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

interface BondTableProps {
  pivotData: PivotData;
  bondData: BondData[];
}

export const BondTable: React.FC<BondTableProps> = ({ pivotData, bondData }) => {
  const [expandedIssuers, setExpandedIssuers] = useState<Set<string>>(new Set());
  
  const toggleIssuer = (issuer: string) => {
    const newExpanded = new Set(expandedIssuers);
    if (newExpanded.has(issuer)) {
      newExpanded.delete(issuer);
    } else {
      newExpanded.add(issuer);
    }
    setExpandedIssuers(newExpanded);
  };

  // Get all unique month-years for column headers
  const allMonthYears = React.useMemo(() => {
    const monthYears = new Set<string>();
    Object.values(pivotData).forEach(bonds => {
      Object.values(bonds).forEach(monthYearData => {
        Object.keys(monthYearData).forEach(monthYear => {
          monthYears.add(monthYear);
        });
      });
    });
    return Array.from(monthYears).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateA.getTime() - dateB.getTime();
    });
  }, [pivotData]);

  // Calculate totals for each issuer
  const issuerTotals = React.useMemo(() => {
    const totals: { [issuer: string]: number } = {};
    Object.entries(pivotData).forEach(([issuer, bonds]) => {
      let total = 0;
      Object.values(bonds).forEach(monthYearData => {
        Object.values(monthYearData).forEach(amount => {
          total += amount;
        });
      });
      totals[issuer] = total;
    });
    return totals;
  }, [pivotData]);

  // Get bond details for tooltip/additional info
  const getBondDetails = (bondName: string) => {
    return bondData.find(bond => bond.bondName === bondName);
  };

  return (
    <Card className="shadow-medium bg-gradient-card border-0">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Investment Details</CardTitle>
        <CardDescription>
          Detailed breakdown by issuer and bond name across investment periods
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="font-semibold">Issuer / Bond</TableHead>
                <TableHead className="font-semibold text-right">Total Investment</TableHead>
                {allMonthYears.map(monthYear => (
                  <TableHead key={monthYear} className="font-semibold text-right min-w-24">
                    {monthYear}
                  </TableHead>
                ))}
                <TableHead className="font-semibold text-center">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(pivotData).sort((a, b) => issuerTotals[b[0]] - issuerTotals[a[0]]).map(([issuer, bonds]) => (
                <React.Fragment key={issuer}>
                  {/* Issuer Row */}
                  <TableRow className="border-border bg-muted/30 hover:bg-muted/50">
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleIssuer(issuer)}
                        className="p-0 h-auto font-semibold text-primary hover:text-primary"
                      >
                        {expandedIssuers.has(issuer) ? (
                          <ChevronDown className="w-4 h-4 mr-1" />
                        ) : (
                          <ChevronRight className="w-4 h-4 mr-1" />
                        )}
                        {issuer}
                        <TrendingUp className="w-4 h-4 ml-2 text-primary" />
                      </Button>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      ₹{issuerTotals[issuer].toLocaleString('en-IN')}
                    </TableCell>
                    {allMonthYears.map(monthYear => {
                      const total = Object.values(bonds).reduce((sum, monthYearData) => {
                        return sum + (monthYearData[monthYear] || 0);
                      }, 0);
                      return (
                        <TableCell key={monthYear} className="text-right font-medium">
                          {total > 0 ? `₹${total.toLocaleString('en-IN')}` : '-'}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="bg-primary-glow text-primary">
                        {Object.keys(bonds).length} bonds
                      </Badge>
                    </TableCell>
                  </TableRow>
                  
                  {/* Bond Rows (when expanded) */}
                  {expandedIssuers.has(issuer) && Object.entries(bonds).map(([bondName, monthYearData]) => {
                    const bondDetails = getBondDetails(bondName);
                    const bondTotal = Object.values(monthYearData).reduce((sum, amount) => sum + amount, 0);
                    
                    return (
                      <TableRow key={bondName} className="border-border bg-card/50">
                        <TableCell className="pl-8">
                          <div className="flex items-center space-x-2">
                            <div>
                              <div className="font-medium text-sm">{bondName}</div>
                              {bondDetails && (
                                <div className="text-xs text-muted-foreground">
                                  ISIN: {bondDetails.isin}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ₹{bondTotal.toLocaleString('en-IN')}
                        </TableCell>
                        {allMonthYears.map(monthYear => (
                          <TableCell key={monthYear} className="text-right">
                            {monthYearData[monthYear] ? `₹${monthYearData[monthYear].toLocaleString('en-IN')}` : '-'}
                          </TableCell>
                        ))}
                        <TableCell className="text-center">
                          {bondDetails && (
                            <div className="flex items-center justify-center space-x-1">
                              {bondDetails.matured ? (
                                <Badge variant="secondary" className="bg-warning-glow text-warning">
                                  <Calendar className="w-3 h-3 mr-1" />
                                  Matured
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-success-glow text-success">
                                  <TrendingUp className="w-3 h-3 mr-1" />
                                  Active
                                </Badge>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {/* Summary Stats */}
        <div className="mt-6 p-4 bg-primary-glow/10 rounded-xl">
          <h4 className="font-semibold mb-3 text-primary flex items-center">
            <AlertCircle className="w-4 h-4 mr-2" />
            Summary Statistics
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Total Issuers</p>
              <p className="font-semibold">{Object.keys(pivotData).length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Bonds</p>
              <p className="font-semibold">{bondData.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Investment Periods</p>
              <p className="font-semibold">{allMonthYears.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Avg XIRR</p>
              <p className="font-semibold">
                {(bondData.reduce((sum, bond) => sum + bond.xirr, 0) / bondData.length).toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};