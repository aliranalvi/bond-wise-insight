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
        <CardTitle className="text-xl font-bold">Active Investment Details</CardTitle>
        <CardDescription>
          Detailed breakdown by issuer across investment periods (excludes matured bonds)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="font-semibold">Bond Issuer</TableHead>
                <TableHead className="font-semibold text-right">Total Active Investment</TableHead>
                {allMonthYears.map(monthYear => (
                  <TableHead key={monthYear} className="font-semibold text-right min-w-24">
                    {monthYear}
                  </TableHead>
                ))}
                <TableHead className="font-semibold text-center">Active Bonds</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(pivotData).sort((a, b) => issuerTotals[b[0]] - issuerTotals[a[0]]).map(([issuer, bonds]) => {
                // Count active bonds for this issuer
                const activeBondsCount = bondData.filter(bond => 
                  bond.bondIssuer === issuer && !bond.matured
                ).length;
                
                return (
                  <TableRow key={issuer} className="border-border bg-muted/30 hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-primary">{issuer}</span>
                      </div>
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
                      <Badge variant="secondary" className="bg-success-glow text-success">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        {activeBondsCount} active
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        
        {/* Summary Stats */}
        <div className="mt-6 p-4 bg-primary-glow/10 rounded-xl">
          <h4 className="font-semibold mb-3 text-primary flex items-center">
            <AlertCircle className="w-4 h-4 mr-2" />
            Active Portfolio Summary
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Active Issuers</p>
              <p className="font-semibold">{Object.keys(pivotData).length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Active Bonds</p>
              <p className="font-semibold">{bondData.filter(bond => !bond.matured).length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Investment Periods</p>
              <p className="font-semibold">{allMonthYears.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Avg XIRR (Active)</p>
              <p className="font-semibold">
                {bondData.filter(bond => !bond.matured).length > 0 
                  ? (bondData.filter(bond => !bond.matured).reduce((sum, bond) => sum + bond.xirr, 0) / bondData.filter(bond => !bond.matured).length).toFixed(2)
                  : '0.00'}%
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};