# Energy Audit Mobile App

## Project Overview
React Native + Expo app for energy auditors in Uzbekistan.
Connects to Flask backend at http://157.180.28.98:5050

## Tech Stack
- React Native with Expo (SDK 53)
- TypeScript
- Navigation: @react-navigation/bottom-tabs
- Backend: Flask REST API on port 5050

## Project Structure
src/screens/ - 4 screens (Dashboard, NewAudit, History, Settings)
src/components/audit-steps/ - 11 form steps matching backend fields
src/api.ts - API service pointing to 157.180.28.98:5050

## Backend API
- GET /cases - list all audits
- GET /cases/<name>/form - get form data
- DELETE /cases/<name> - delete (passcode: abulika8)
- POST /generate - submit audit, generates Word+Excel+Passport

## Key Backend Field Names
- Basic: aud_date, insp_date, aud_name, owner, region, city, mfy, street, house
- Building: floors, rooms, area_total, heat_area, yr_built, wall_mat, roof_mat
- Dimensions: floor_l1/w1, door_w1/h1/n1, win_w1/h1/n1, wall_p1/h1
- Appliances: apl1_name/w/n/hrs ... apl10_name/w/n/hrs
- Energy: gas_2023_0..11, elec_2023_0..11, other_2023_0..11 (same 2024,2025)
- Solar: fes_kw, grid, gelio_l, ariston_count, ariston_kW
- Measurements: r1_temp, r1_hum, r1_lux, r2_temp, r2_hum, r2_lux

## Running
npx expo start --web   # development
npx expo start --ios   # broken (Expo Go new arch issue)
npx eas build --platform android  # Play Store build

## Known Issues
- iOS simulator fails due to Expo Go forcing new architecture
- react-native-chart-kit removed (new arch incompatible)
- Use web browser for testing
