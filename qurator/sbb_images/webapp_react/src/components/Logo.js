import React from "react";
import { ReactComponent as LogoSBB } from "../assets/SBB_Logo.svg";

const Logo = ({ className }) => (
    <LogoSBB
      className={className}
      style={{ fill: "currentColor", opacity: 1 }} 
    />
  );

export default Logo;


