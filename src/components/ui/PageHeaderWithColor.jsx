import React from 'react';
import { useColorScheme } from '@/lib/useColorScheme';
import PageHeader from '@/components/ui/PageHeader';

export default function PageHeaderWithColor(props) {
  const { colorScheme } = useColorScheme();
  
  return (
    <PageHeader
      {...props}
      actionButtonStyle={{ backgroundColor: colorScheme.primary }}
      actionButtonClass="text-white"
    />
  );
}