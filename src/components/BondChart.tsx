import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface PivotData {
  [issuer: string]: {
    [bondName: string]: {
      [monthYear: string]: number;
    };
  };
}

interface BondChartProps {
  pivotData: PivotData;
}

export const BondChart: React.FC<BondChartProps> = ({ pivotData }) => {
  // Transform pivot data for chart
  const chartData = React.useMemo(() => {
    const monthYearTotals: { [monthYear: string]: number } = {};
    const issuerColors: { [issuer: string]: string } = {};
    
    // Color palette for issuers
    const colors = [
      'hsl(180, 100%, 35%)', // primary
      'hsl(160, 60%, 45%)', // accent
      'hsl(140, 70%, 40%)', // success
      'hsl(45, 90%, 55%)', // warning
      'hsl(260, 60%, 50%)', // purple
      'hsl(340, 70%, 50%)', // pink
      'hsl(20, 80%, 55%)', // orange
      'hsl(200, 70%, 45%)', // blue
    ];
    
    let colorIndex = 0;
    
    // First pass: collect all month-years and assign colors
    Object.entries(pivotData).forEach(([issuer, bonds]) => {
      issuerColors[issuer] = colors[colorIndex % colors.length];
      colorIndex++;
      
      Object.values(bonds).forEach(monthYearData => {
        Object.entries(monthYearData).forEach(([monthYear, amount]) => {
          if (!monthYearTotals[monthYear]) {
            monthYearTotals[monthYear] = 0;
          }
          monthYearTotals[monthYear] += amount;
        });
      });
    });
    
    // Second pass: create chart data structure
    const sortedMonthYears = Object.keys(monthYearTotals).sort((a, b) => {
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateA.getTime() - dateB.getTime();
    });
    
    return {
      data: sortedMonthYears.map(monthYear => {
        const entry: any = { monthYear };
        
        Object.entries(pivotData).forEach(([issuer, bonds]) => {
          let issuerTotal = 0;
          Object.values(bonds).forEach(monthYearData => {
            if (monthYearData[monthYear]) {
              issuerTotal += monthYearData[monthYear];
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
  }, [pivotData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card p-3 rounded-lg shadow-medium border">
          <p className="font-semibold mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.dataKey}: ₹{entry.value.toLocaleString('en-IN')}
            </p>
          ))}
          <p className="text-sm font-semibold mt-2 pt-2 border-t">
            Total: ₹{payload.reduce((sum: number, entry: any) => sum + entry.value, 0).toLocaleString('en-IN')}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="shadow-medium bg-gradient-card border-0 mb-6">
      <CardHeader>
        <CardTitle className="text-xl font-bold">Investment Timeline by Issuer</CardTitle>
        <CardDescription>
          Monthly investment amounts grouped by bond issuer
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-96">
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
                dataKey="monthYear" 
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
      </CardContent>
    </Card>
  );
};