import React from "react";
import useBreakpoint from '@/hooks/useBreakpoint';
import './components.css';

export const Button = ({ className = '', ...props }) => (
  <button
    className={`ui-button ${className}`}
    {...props}
  />
);

export const Input = ({ className, ...props }) => (
  <input className={`ui-input ${className}`} {...props} />
);

export const Card = ({ children, className }) => (
  <div className={`ui-card ${className}`}>{children}</div>
);

export const CardHeader = ({ children, className }) => <div className={`ui-card-header ${className}`}>{children}</div>;
export const CardTitle = ({ children, className }) => <h2 className={`ui-card-title ${className}`}>{children}</h2>;
export const CardContent = ({ children, className }) => <div className={`ui-card-content ${className}`}>{children}</div>;

export const Badge = ({ children, className }) => (
  <span className={`ui-badge ${className}`}>{children}</span>
);

export const Label = ({ children, className }) => (
  <label className={`ui-label ${className}`}>{children}</label>
);

export const Alert = ({ children, className, variant }) => (
  <div className={`ui-alert ${variant === 'destructive' ? 'ui-alert-destructive' : 'ui-alert-info'} ${className}`}>
    {children}
  </div>
);

export const AlertDescription = ({ children }) => <div className="ui-alert-description">{children}</div>;

// Tabs implementation
export const Tabs = ({ children, defaultValue, className }) => {
  const [active, setActive] = React.useState(defaultValue);
  return <div className={`ui-tabs ${className}`}>{React.Children.map(children, child => React.isValidElement(child) ? React.cloneElement(child, { active, setActive }) : child)}</div>;
};
export const TabsList = ({ children, className, active, setActive }) => (
  <div className={`ui-tabs-list ${className}`}>
    {React.Children.map(children, child => React.isValidElement(child) ? React.cloneElement(child, { active, setActive }) : child)}
  </div>
);
export const TabsTrigger = ({ children, value, active, setActive, className }) => (
  <button onClick={() => setActive && setActive(value)} className={`ui-tabs-trigger ${active === value ? 'ui-tabs-trigger-active' : ''} ${className}`}>{children}</button>
);
export const TabsContent = ({ children, value, active }) => active === value ? <div className="ui-tabs-content">{children}</div> : null;

// Textarea wrapper
export const Textarea = ({ className, ...props }) => (
  <textarea className={`ui-textarea ${className}`} {...props} />
);

// RadioGroup and RadioGroupItem
export const RadioGroup = ({ children, className, name }) => (
  <div role="radiogroup" className={`ui-radio-group ${className}`} data-name={name}>{children}</div>
);

export const RadioGroupItem = ({ value, className, children, ...props }) => (
  <label className={`ui-radio-item ${className}`}>
    <input type="radio" value={value} {...props} />
    <span>{children}</span>
  </label>
);

// Functional Dialog component
export const Dialog = ({ children, open, onOpenChange }) => {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  return (
    <>
      {open && (
        <div 
          className="ui-dialog-overlay"
          onClick={() => onOpenChange?.(false)}
        />
      )}
      <div className={open ? 'visible' : 'hidden'}>
        {children}
      </div>
    </>
  );
};

export const DialogContent = ({ children, className }) => <div className={`ui-dialog-content ${className}`}>{children}</div>;
export const DialogHeader = ({ children, className }) => <div className={`ui-dialog-header ${className}`}>{children}</div>;
export const DialogTitle = ({ children, className }) => <h3 className={`ui-dialog-title ${className}`}>{children}</h3>;

// Basic table primitives
export const Table = ({ children, className }) => <div className={`ui-table-wrapper ${className}`}><table className="ui-table">{children}</table></div>;
export const TableHeader = ({ children, className }) => <thead className={`ui-table-header ${className}`}>{children}</thead>;
export const TableBody = ({ children, className }) => <tbody className={`ui-table-body ${className}`}>{children}</tbody>;
export const TableRow = ({ children, className }) => <tr className={`ui-table-row ${className}`}>{children}</tr>;
export const TableHead = ({ children, className }) => <th className={`ui-table-head ${className}`}>{children}</th>;
export const TableCell = ({ children, className }) => <td className={`ui-table-cell ${className}`}>{children}</td>;

// Switch toggle
export const Switch = ({ checked, onChange, className }) => (
  <label className={`ui-switch ${className}`}>
    <input type="checkbox" checked={checked} onChange={onChange} />
    <span className="switch-label">Toggle</span>
  </label>
);

// DialogTrigger (simple passthrough)
export const DialogTrigger = ({ children }) => <>{children}</>;

// Functional Select components
export const Select = ({ children, value, onValueChange, className = '' }) => {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef(null);
  const contentRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        contentRef.current && !contentRef.current.contains(e.target) &&
        triggerRef.current && !triggerRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const contextValue = {
    open,
    setOpen,
    value,
    onValueChange,
    triggerRef,
    contentRef
  };

  return (
    <SelectContext.Provider value={contextValue}>
      <div className={`ui-select ${className}`}>{children}</div>
    </SelectContext.Provider>
  );
};

const SelectContext = React.createContext();

export const SelectTrigger = ({ children, className = '' }) => {
  const context = React.useContext(SelectContext);
  if (!context) return <div className={`ui-select-trigger ${className}`}>{children}</div>;

  return (
    <button
      onClick={() => context.setOpen(!context.open)}
      className={`ui-select-trigger ${className}`}
      type="button"
    >
      {children}
      <span className="select-arrow">▼</span>
    </button>
  );
};

export const SelectValue = ({ placeholder = '', className = '' }) => {
  const context = React.useContext(SelectContext);
  const selectedValue = context?.value || '';

  if (!context) return <span className={`select-value ${className}`}>{placeholder}</span>;

  return (
    <span className={`select-value ${className}`}>
      {selectedValue || placeholder}
    </span>
  );
};

export const SelectContent = ({ children, className = '' }) => {
  const context = React.useContext(SelectContext);
  if (!context?.open) return null;

  return (
    <div
      className={`ui-select-content ${className}`}
    >
      {children}
    </div>
  );
};

export const SelectItem = ({ children, className = '', value, disabled = false }) => {
  const context = React.useContext(SelectContext);
  if (!context) return <div className={`ui-select-item ${className}`}>{children}</div>;

  const handleClick = () => {
    if (!disabled) {
      context.onValueChange?.(value);
      context.setOpen(false);
    }
  };

  const isSelected = context.value === value;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`ui-select-item ${isSelected ? 'ui-select-item-selected' : ''} ${className}`}
    >
      {children}
    </button>
  );
};

// Popover primitives
export const Popover = ({ children, className }) => <div className={`ui-popover ${className}`}>{children}</div>;
export const PopoverTrigger = ({ children }) => <>{children}</>;
export const PopoverContent = ({ children, className }) => <div className={`ui-popover-content ${className}`}>{children}</div>;

// Responsive layout primitives
export const Container = ({ children, className }) => (
  <div className={`ui-container ${className}`}>{children}</div>
);

export const Stack = ({ children, gap = 16, className = '', style = {} }) => (
  <div className={`ui-stack ${className}`} style={{ gap: `${gap}px`, ...style }}>{children}</div>
);

export const Grid = ({ children, cols = 2, gap = 16, className = '', style = {} }) => {
  const { bp } = useBreakpoint();
  const activeCols = bp === 'sm' ? 1 : cols;
  return (
    <div
      className={`ui-grid ${className}`}
      style={{
        gridTemplateColumns: `repeat(${activeCols}, minmax(0, 1fr))`,
        gap: `${gap}px`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const IconButton = ({ children, className = '', ...props }) => (
  <button
    className={`ui-icon-button ${className}`}
    {...props}
  >
    {children}
  </button>
);