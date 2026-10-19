import type React from 'react'
export interface InviteQrScannerProps { active:boolean; onResult(token:string):void; onManualEntry():void }
export default function InviteQrScanner(props:InviteQrScannerProps):React.ReactElement
