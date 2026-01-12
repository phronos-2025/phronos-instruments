/**
 * Error Screen
 * 
 * Expired link, already joined, not found states
 */

import React from 'react';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';

interface ErrorScreenProps {
  error: 'expired' | 'already_joined' | 'not_found' | 'network';
}

export const ErrorScreen: React.FC<ErrorScreenProps> = ({ error }) => {
  const getErrorContent = () => {
    switch (error) {
      case 'expired':
        return {
          title: 'Link Expired',
          message: 'This link has expired.',
          detail: 'Ask your friend for a new one.'
        };
      case 'already_joined':
        return {
          title: 'Already Joined',
          message: 'This game already has a recipient.',
          detail: 'The sender can generate a new link if needed.'
        };
      case 'not_found':
        return {
          title: 'Game Not Found',
          message: 'This game could not be found.',
          detail: 'The link may be invalid or the game may have been deleted.'
        };
      case 'network':
        return {
          title: 'Connection Error',
          message: 'Failed to connect to the server.',
          detail: 'Please check your connection and try again.'
        };
      default:
        return {
          title: 'Error',
          message: 'An unexpected error occurred.',
          detail: 'Please try again later.'
        };
    }
  };
  
  const { title, message, detail } = getErrorContent();
  
  return (
    <div>
      <Panel title={title}>
        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
          <div style={{ 
            fontSize: '3rem', 
            marginBottom: '1rem',
            color: 'var(--alert)'
          }}>
            ◈
          </div>
          <p style={{ 
            fontSize: '1.2rem', 
            color: 'var(--text-light)', 
            marginBottom: '0.5rem' 
          }}>
            {message}
          </p>
          <p style={{ 
            fontSize: 'var(--text-sm)', 
            color: 'var(--faded)' 
          }}>
            {detail}
          </p>
        </div>
        
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Button
            variant="primary"
            onClick={() => window.location.href = '/'}
          >
            Back to Home
          </Button>
        </div>
      </Panel>
    </div>
  );
};
