import React, { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  title?: string;
  children: ReactNode;
  maxWidth?: string;
  zIndex?: number;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, title, children, maxWidth = '300px', zIndex = 1000 }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
      backgroundColor: 'rgba(0,0,0,0.7)', zIndex: zIndex, 
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div style={{
        backgroundColor: '#333', padding: '20px', borderRadius: '8px', 
        width: '90%', maxWidth: maxWidth, display: 'flex', flexDirection: 'column',
        textAlign: 'center'
      }}>
        {title && <h3 style={{ color: 'white', marginTop: 0, marginBottom: '20px' }}>{title}</h3>}
        {children}
      </div>
    </div>
  );
};

interface ModalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'danger';
}

export const ModalButton: React.FC<ModalButtonProps> = ({ variant = 'default', style, children, ...props }) => {
  let bgColor = '#555';
  if (variant === 'primary') bgColor = '#4CAF50';
  if (variant === 'danger') bgColor = '#e53935';

  return (
    <button 
      {...props}
      style={{ 
        padding: '10px', 
        backgroundColor: bgColor, 
        color: 'white', 
        border: 'none', 
        borderRadius: '4px', 
        fontSize: '16px',
        opacity: props.disabled ? 0.5 : 1,
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        fontWeight: variant !== 'default' ? 'bold' : 'normal',
        ...style 
      }}
    >
      {children}
    </button>
  );
};
