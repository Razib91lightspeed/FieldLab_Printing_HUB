import { PrinterData } from '../types';

export const INITIAL_PRINTERS: PrinterData[] = [
  { id: 'p1', name: 'Bambu A1', status: 'printing', jobName: 'Housing_V2.stl', progress: 65, timeRemaining: '1h 20m', elapsedTime: '2h 10m', nozzleTemp: 215, nozzleTarget: 215, bedTemp: 60, bedTarget: 60, material: 'PLA', color: 'Red', alerts: 0 },
  { id: 'p2', name: 'Bambu A2', status: 'idle', jobName: '-', progress: 0, timeRemaining: '-', elapsedTime: '-', nozzleTemp: 24, nozzleTarget: 0, bedTemp: 24, bedTarget: 0, material: 'PETG', color: 'Clear', alerts: 0 },
  { id: 'p3', name: 'Bambu A3', status: 'error', jobName: 'Gear_Shift.gcode', progress: 12, timeRemaining: 'Stalled', elapsedTime: '15m', nozzleTemp: 180, nozzleTarget: 200, bedTemp: 60, bedTarget: 60, material: 'ABS', color: 'Black', alerts: 2 },
  { id: 'p4', name: 'Bambu A4', status: 'printing', jobName: 'Bracket_Support.stl', progress: 89, timeRemaining: '12m', elapsedTime: '4h 05m', nozzleTemp: 250, nozzleTarget: 250, bedTemp: 90, bedTarget: 90, material: 'ASA', color: 'Blue', alerts: 0 },
  { id: 'p5', name: 'Bambu A5', status: 'finished', jobName: 'Test_Cube.gcode', progress: 100, timeRemaining: 'Done', elapsedTime: '45m', nozzleTemp: 35, nozzleTarget: 0, bedTemp: 30, bedTarget: 0, material: 'PLA', color: 'White', alerts: 1 },
];
