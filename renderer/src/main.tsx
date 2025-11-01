import { createRoot } from 'react-dom/client'
import {createHashRouter, RouterProvider} from "react-router"
import Routes from './routes';
import "./styles/global.css"
import "./styles/blockWebAction.css"
import "./styles/outline_icon.css"
const route=createHashRouter(Routes);
createRoot(document.getElementById('root')!).render(
  <RouterProvider router={route}/> 
)
