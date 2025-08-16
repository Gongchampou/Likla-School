import React from 'react';
import { ClassIcon } from '../components/icons';

interface PlaceholderPageProps {
  pageName: string;
}

const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ pageName }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="p-6 bg-accent dark:bg-dark-accent rounded-full mb-6">
        <ClassIcon className="w-16 h-16 text-primary" />
      </div>
      <h1 className="text-4xl font-bold mb-2">{pageName}</h1>
      <p className="text-lg text-muted-foreground dark:text-dark-muted-foreground">This page is under construction.</p>
      <p className="mt-4 max-w-md text-muted-foreground dark:text-dark-muted-foreground">
        The functionality for managing {pageName.toLowerCase()} will be available here soon. 
        Thank you for your patience as we continue to build out the LIKLA School Management system.
      </p>
    </div>
  );
};

export default PlaceholderPage;