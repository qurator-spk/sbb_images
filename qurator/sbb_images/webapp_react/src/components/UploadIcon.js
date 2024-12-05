// UploadIcon component done to import the svg icon, which only worked like this
import React from 'react';
import { ReactComponent as UploadIconBlue } from '../assets/upload-solid.svg';

const UploadIcon = ({ className }) => <UploadIconBlue className={className} />;
export default UploadIcon;
